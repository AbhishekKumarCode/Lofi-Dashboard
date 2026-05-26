// ============================================================
//  server-runner.js
//  The Express server, bundled inside Electron.
//  Called from main.js — receives staticDir and settingsPath
//  so it works both in dev and packaged .exe
// ============================================================
module.exports = function startServer(staticDir, settingsPath, onReady) {

  var express = require('express');
  var exec    = require('child_process').exec;
  var si      = require('systeminformation');
  var path    = require('path');
  var fs      = require('fs');

  var app  = express();
  var PORT = 3000;

  var LASTFM_USERNAME = 'Abhishek-29481';
  var LASTFM_API_KEY  = 'b25b959554ed76058ac220b7b2e0a026';
  var WEATHER_LAT     = 28.6139;
  var WEATHER_LON     = 77.2090;

  // ── CORS + NO CACHE ────────────────────────────────────────
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin',  '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma',  'no-cache');
    res.header('Expires', '0');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
  app.use(express.json());

  // ── NOW PLAYING (Last.fm) ───────────────────────────────────
  var currentTrack = { artist:'', title:'', album:'', albumArt:'', isPlaying:false, duration:0, scrobbledAt:0 };

  function fetchLastFm() {
    var url = 'https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user='+LASTFM_USERNAME+'&api_key='+LASTFM_API_KEY+'&format=json&limit=1&extended=1';
    fetch(url).then(function(r){ return r.json(); }).then(function(data) {
      var track = data.recenttracks && data.recenttracks.track && data.recenttracks.track[0];
      if (!track) { currentTrack.isPlaying = false; return; }
      var isPlaying = !!(track['@attr'] && track['@attr'].nowplaying === 'true');
      var images = track.image || [];
      var albumArt = '';
      for (var i=0; i<images.length; i++) { if (images[i].size==='large') { albumArt = images[i]['#text']; break; } }
      var newTitle  = track.name || '';
      var newArtist = (track.artist && (track.artist.name || track.artist['#text'])) || '';
      if (newTitle !== currentTrack.title || newArtist !== currentTrack.artist) {
        currentTrack.scrobbledAt = isPlaying ? Date.now() : 0;
        currentTrack.duration    = track.duration ? parseInt(track.duration)*1000 : 0;
      }
      currentTrack = { artist:newArtist, title:newTitle, album:(track.album&&track.album['#text'])||'', albumArt:albumArt, isPlaying:isPlaying, duration:currentTrack.duration, scrobbledAt:isPlaying?(currentTrack.scrobbledAt||Date.now()):0 };
    }).catch(function(){});
  }
  fetchLastFm();
  setInterval(fetchLastFm, 3000);
  app.get('/now-playing', function(req, res) { res.json(currentTrack); });

  // ── SPOTIFY CONTROLS ────────────────────────────────────────
  // Persistent PowerShell process — spawned once, type compiled once,
  // each button press just writes one line → ~instant response.
  var VK = { playpause: 0xB3, next: 0xB0, prev: 0xB1, volumeup: 0xAF, volumedown: 0xAE };
  var psProc = null;

  function ensurePS() {
    if (psProc && !psProc.killed) return;
    var spawn = require('child_process').spawn;
    psProc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
      stdio: ['pipe', 'ignore', 'ignore']
    });
    psProc.on('exit', function() { psProc = null; });
    // Compile the type once — backtick-quote escapes " inside PS double-string
    psProc.stdin.write(
      'Add-Type -TypeDefinition "using System; using System.Runtime.InteropServices; ' +
      'public class MK { [DllImport(`"user32.dll`")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo); ' +
      'public static void Press(byte vk) { keybd_event(vk,0,0,0); keybd_event(vk,0,2,0); } }"\r\n'
    );
  }

  // Warm up immediately so first keypress is instant
  ensurePS();

  function sendMediaKey(vkCode) {
    ensurePS();
    try {
      psProc.stdin.write('[MK]::Press(' + vkCode + ')\r\n');
    } catch(e) {
      psProc = null;
      ensurePS();
      psProc.stdin.write('[MK]::Press(' + vkCode + ')\r\n');
    }
  }

  app.post('/control/:action', function(req, res) {
    var vk = VK[req.params.action];
    if (vk) sendMediaKey(vk);
    res.json({ ok: true });
  });

  // ── PC STATS ────────────────────────────────────────────────
  var pcStats = { cpu:0, ram:0, gpu:0, temp:0 };
  function updateStats() {
    Promise.all([si.currentLoad(), si.mem(), si.cpuTemperature()]).then(function(vals) {
      pcStats = { cpu:Math.round(vals[0].currentLoad), ram:Math.round((vals[1].used/vals[1].total)*100), gpu:0, temp:Math.round(vals[2].main)||0 };
    }).catch(function(){});
  }
  updateStats();
  setInterval(updateStats, 5000);
  app.get('/pc-stats', function(req, res) { res.json(pcStats); });

  // ── WEATHER ─────────────────────────────────────────────────
  var https = require('https');
  var weatherIcons = {0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',71:'❄️',73:'❄️',75:'❄️',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈'};
  var weatherData  = { temp:'--', description:'loading...', humidity:'--', windspeed:'--', icon:'🌡' };
  var forecastData = [];
  var weatherLog   = [];  // debug log

  function wLog(msg) {
    var entry = new Date().toISOString().slice(11,19) + ' ' + msg;
    weatherLog.push(entry);
    if (weatherLog.length > 30) weatherLog.shift();
    console.log('[weather]', msg);
  }

  function httpsGet(url, callback) {
    wLog('GET ' + url.slice(0,60));
    var req = https.get(url, { timeout: 8000 }, function(res) {
      var body = '';
      res.on('data', function(d){ body += d; });
      res.on('end', function(){
        try {
          var parsed = JSON.parse(body);
          wLog('OK status=' + res.statusCode + ' bytes=' + body.length);
          callback(null, parsed);
        } catch(e) { wLog('parse error: ' + e.message); callback(e); }
      });
    });
    req.on('timeout', function(){ wLog('TIMEOUT'); req.destroy(); });
    req.on('error', function(e){ wLog('ERROR: ' + e.message); callback(e); });
  }

  function updateWeather(retry) {
    httpsGet(
      'https://api.open-meteo.com/v1/forecast?latitude='+WEATHER_LAT+'&longitude='+WEATHER_LON+'&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
      function(err, data) {
        if (!err && data && data.current) {
          var c = data.current;
          var wmap = {0:'clear sky',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'foggy',51:'light drizzle',61:'light rain',63:'rain',65:'heavy rain',71:'light snow',73:'snow',80:'showers',95:'thunderstorm'};
          weatherData = { temp:Math.round(c.temperature_2m), description:wmap[c.weather_code]||'clear', icon:weatherIcons[c.weather_code]||'🌡', humidity:c.relative_humidity_2m, windspeed:Math.round(c.wind_speed_10m) };
          wLog('weather updated: ' + weatherData.temp + '°C');
        } else {
          wLog('weather failed, retries left: ' + retry);
          if (retry > 0) setTimeout(function(){ updateWeather(retry-1); }, 6000);
        }
      }
    );
  }
  updateWeather(20);
  setInterval(function(){ updateWeather(3); }, 600000);
  app.get('/weather', function(req, res) { res.json(weatherData); });

  // ── FORECAST ────────────────────────────────────────────────
  function updateForecast(retry) {
    httpsGet(
      'https://api.open-meteo.com/v1/forecast?latitude='+WEATHER_LAT+'&longitude='+WEATHER_LON+'&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FKolkata&forecast_days=5',
      function(err, data) {
        if (!err && data && data.daily && data.daily.time) {
          var d = data.daily;
          var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          forecastData = [];
          for (var i=0; i<d.time.length; i++) {
            var day = new Date(d.time[i]);
            forecastData.push({ day:i===0?'Today':days[day.getDay()], hi:Math.round(d.temperature_2m_max[i]), lo:Math.round(d.temperature_2m_min[i]), icon:weatherIcons[d.weather_code[i]]||'🌡', desc:'clear' });
          }
          wLog('forecast updated: ' + forecastData.length + ' days');
        } else {
          wLog('forecast failed, retries left: ' + retry);
          if (retry > 0) setTimeout(function(){ updateForecast(retry-1); }, 6000);
        }
      }
    );
  }
  updateForecast(20);
  setInterval(function(){ updateForecast(3); }, 1800000);

  // ── DEBUG endpoint — open http://192.168.1.13:3000/debug ────
  app.get('/debug', function(req, res) {
    res.json({ weatherData: weatherData, forecastCount: forecastData.length, log: weatherLog });
  });
  app.get('/forecast', function(req, res) { res.json(forecastData); });

  // ── SETTINGS (theme + wallpaper) ────────────────────────────
  var appSettings = { theme:'lofi', wallpaper:'default' };
  try { appSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e) {}

  app.get('/settings', function(req, res) { res.json(appSettings); });
  app.post('/settings', function(req, res) {
    appSettings = Object.assign(appSettings, req.body);
    try { fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2)); } catch(e) {}
    res.json({ ok: true });
  });

  // ── WALLPAPER PROXY ─────────────────────────────────────────
  var WALLPAPERS = {
    default:   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1280&q=60',
    rain:      'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1280&q=60',
    cafe:      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1280&q=60',
    city:      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1280&q=60',
    forest:    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1280&q=60',
    mountains: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&q=60',
  };
  var wallpaperCache = {};

  app.get('/wallpaper', function(req, res) {
    var id  = req.query.id  || 'default';
    var url = req.query.url || WALLPAPERS[id] || WALLPAPERS.default;
    var key = id === 'custom' ? url : id;
    if (wallpaperCache[key]) { res.setHeader('Content-Type', wallpaperCache[key].type); return res.send(wallpaperCache[key].data); }
    fetch(url).then(function(r){ return r.arrayBuffer().then(function(buf){
      var data = Buffer.from(buf); var type = r.headers.get('content-type')||'image/jpeg';
      wallpaperCache[key] = { data:data, type:type };
      res.setHeader('Content-Type', type); res.send(data);
    }); }).catch(function(){ res.status(500).end(); });
  });

  // ── FONT PROXY ──────────────────────────────────────────────
  var fontCssCache = null;
  var fontFileCache = {};
  var GFONTS_URL = 'https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300&family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap';

  app.get('/font-css', function(req, res) {
    res.setHeader('Content-Type', 'text/css');
    if (fontCssCache) return res.send(fontCssCache);
    fetch(GFONTS_URL, { headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120'} })
      .then(function(r){ return r.text(); })
      .then(function(css){ fontCssCache = css.replace(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g,"url('/font-file?u=$1')"); res.send(fontCssCache); })
      .catch(function(){ res.status(500).send(''); });
  });

  app.get('/font-file', function(req, res) {
    var url = req.query.u;
    if (!url || !url.startsWith('https://fonts.gstatic.com')) return res.status(400).end();
    if (fontFileCache[url]) { res.setHeader('Content-Type','font/woff2'); return res.send(fontFileCache[url]); }
    fetch(url).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
      fontFileCache[url] = Buffer.from(buf); res.setHeader('Content-Type','font/woff2'); res.send(fontFileCache[url]);
    }).catch(function(){ res.status(500).end(); });
  });

  // ── SERVE DASHBOARD ─────────────────────────────────────────
  app.get('/', function(req, res) {
    var filePath = path.join(staticDir, 'index.html');
    fs.readFile(filePath, 'utf8', function(err, html) {
      if (err) return res.status(500).send('index.html not found at ' + filePath);
      html = html.replace('</title>', '</title><!-- built:' + Date.now() + ' -->');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });
  });

  app.use(express.static(staticDir));

  // ── START ────────────────────────────────────────────────────
  var server = app.listen(PORT, '0.0.0.0', function() {
    if (onReady) onReady(PORT, null);
  });
  server.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
      // Port already in use — another instance is likely running
      if (onReady) onReady(PORT, err);
    }
  });
};
