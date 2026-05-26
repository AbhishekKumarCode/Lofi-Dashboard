// ============================================================
//  LOFI DASHBOARD SERVER v3
// ============================================================
const express = require('express');
const { exec } = require('child_process');
const si = require('systeminformation');
const path = require('path');
const fs = require('fs');

const app  = express();
const PORT = 3000;

const LASTFM_USERNAME = 'Abhishek-29481';
const LASTFM_API_KEY  = 'b25b959554ed76058ac220b7b2e0a026';
const WEATHER_LAT = 28.6139;
const WEATHER_LON = 77.2090;

// ── CORS + NO CACHE on everything ────────────────────────────
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  res.header('ngrok-skip-browser-warning', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// ── NOW PLAYING ───────────────────────────────────────────────
var currentTrack = { artist:'nothing playing', title:'', album:'', albumArt:'', isPlaying:false, duration:0, scrobbledAt:0 };

function fetchLastFm() {
  var url = 'https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user='+LASTFM_USERNAME+'&api_key='+LASTFM_API_KEY+'&format=json&limit=1&extended=1';
  fetch(url).then(function(r){ return r.json(); }).then(function(data) {
    var track = data.recenttracks && data.recenttracks.track && data.recenttracks.track[0];
    if (!track) { currentTrack.isPlaying = false; return; }
    var isPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
    var images = track.image || [];
    var albumArt = '';
    for (var i=0; i<images.length; i++) { if (images[i].size === 'large') { albumArt = images[i]['#text']; break; } }
    var newTitle = track.name || '';
    var newArtist = (track.artist && (track.artist.name || track.artist['#text'])) || '';
    // detect song change — reset scrobble time
    if (newTitle !== currentTrack.title || newArtist !== currentTrack.artist) {
      currentTrack.scrobbledAt = isPlaying ? Date.now() : 0;
      currentTrack.duration = track.duration ? parseInt(track.duration) * 1000 : 0;
    }
    currentTrack = {
      artist:      newArtist,
      title:       newTitle,
      album:       (track.album && track.album['#text']) || '',
      albumArt:    albumArt,
      isPlaying:   isPlaying,
      duration:    currentTrack.duration,
      scrobbledAt: isPlaying ? (currentTrack.scrobbledAt || Date.now()) : 0
    };
  }).catch(function(){});
}
fetchLastFm();
setInterval(fetchLastFm, 3000);
app.get('/now-playing', function(req, res) { res.json(currentTrack); });

// ── CONTROLS ─────────────────────────────────────────────────
function sendSpotifyKey(keys) {
  var cmd = 'powershell -command "Add-Type -AssemblyName System.Windows.Forms; $s = Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0}; if ($s) { Add-Type @\'using System; using System.Runtime.InteropServices; public class W { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr h); }\'; [W]::SetForegroundWindow($s.MainWindowHandle); Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait(\''+keys+'\') }"';
  exec(cmd);
}
app.post('/control/:action', function(req, res) {
  var map = { playpause:' ', next:'^{RIGHT}', prev:'^{LEFT}', volumeup:'^{UP}', volumedown:'^{DOWN}' };
  if (map[req.params.action]) sendSpotifyKey(map[req.params.action]);
  res.json({ ok: true });
});

// ── PC STATS ─────────────────────────────────────────────────
var pcStats = { cpu:0, ram:0, gpu:0, temp:0 };
function updateStats() {
  Promise.all([si.currentLoad(), si.mem(), si.cpuTemperature()]).then(function(vals) {
    pcStats = { cpu: Math.round(vals[0].currentLoad), ram: Math.round((vals[1].used/vals[1].total)*100), gpu: 0, temp: Math.round(vals[2].main)||0 };
  }).catch(function(){});
}
updateStats();
setInterval(updateStats, 5000);
app.get('/pc-stats', function(req, res) { res.json(pcStats); });

// ── WEATHER ──────────────────────────────────────────────────
var weatherCodes = {0:'clear sky',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'foggy',48:'foggy',51:'light drizzle',53:'drizzle',55:'heavy drizzle',61:'light rain',63:'rain',65:'heavy rain',71:'light snow',73:'snow',75:'heavy snow',80:'showers',81:'showers',82:'heavy showers',95:'thunderstorm',96:'thunderstorm',99:'thunderstorm'};
var weatherIcons = {0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',71:'❄️',73:'❄️',75:'❄️',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈'};
var weatherData = { temp:'--', description:'loading...', humidity:'--', windspeed:'--', icon:'🌡' };
function updateWeather() {
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+WEATHER_LAT+'&longitude='+WEATHER_LON+'&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code')
    .then(function(r){ return r.json(); }).then(function(data) {
      var c = data.current;
      weatherData = { temp: Math.round(c.temperature_2m), description: weatherCodes[c.weather_code]||'clear', icon: weatherIcons[c.weather_code]||'🌡', humidity: c.relative_humidity_2m, windspeed: Math.round(c.wind_speed_10m) };
    }).catch(function(){});
}
updateWeather();
setInterval(updateWeather, 600000);
app.get('/weather', function(req, res) { res.json(weatherData); });

// ── FORECAST ─────────────────────────────────────────────────
var forecastData = [];
function updateForecast() {
  fetch('https://api.open-meteo.com/v1/forecast?latitude='+WEATHER_LAT+'&longitude='+WEATHER_LON+'&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia%2FKolkata&forecast_days=5')
    .then(function(r){ return r.json(); }).then(function(data) {
      var d = data.daily;
      var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      forecastData = [];
      for (var i=0; i<d.time.length; i++) {
        var day = new Date(d.time[i]);
        forecastData.push({ day: i===0?'Today':dayNames[day.getDay()], hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), icon: weatherIcons[d.weather_code[i]]||'🌡', desc: weatherCodes[d.weather_code[i]]||'clear' });
      }
    }).catch(function(){});
}
updateForecast();
setInterval(updateForecast, 1800000);
app.get('/forecast', function(req, res) { res.json(forecastData); });

// ── SERVE MANIFEST + ICONS (PWA) ─────────────────────────────
var manifestPath = path.join(__dirname, 'manifest.json');
function serveManifest(req, res) {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(manifestPath);
}
app.get('/manifest.json', serveManifest);
app.get('/manifest',      serveManifest); // without .json too
app.get('/icon-192.png',  function(req, res) { res.sendFile(path.join(__dirname, 'icon-192.png')); });
app.get('/icon-512.png',  function(req, res) { res.sendFile(path.join(__dirname, 'icon-512.png')); });

// ── SERVE DASHBOARD — inject timestamp to bust cache ─────────
app.get('/', function(req, res) {
  var filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, 'utf8', function(err, html) {
    if (err) return res.status(500).send('index.html not found');
    // inject a timestamp comment so browser always sees a "new" page
    html = html.replace('</title>', '</title><!-- built:' + Date.now() + ' -->');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

// serve other static files normally
app.use(express.static(path.join(__dirname)));

// ── SETTINGS (theme + wallpaper) ─────────────────────────────
var SETTINGS_FILE = path.join(__dirname, 'settings.json');
var appSettings = { theme: 'lofi', wallpaper: 'default' };
try { appSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch(e) {}

app.get('/settings', function(req, res) { res.json(appSettings); });
app.post('/settings', function(req, res) {
  appSettings = Object.assign(appSettings, req.body);
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2)); } catch(e) {}
  res.json({ ok: true });
});

// ── WALLPAPER PROXY — serves Unsplash images to tablet ───────
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
  if (wallpaperCache[key]) {
    res.setHeader('Content-Type', wallpaperCache[key].type);
    return res.send(wallpaperCache[key].data);
  }
  fetch(url).then(function(r) { return r.arrayBuffer().then(function(buf) {
    var data = Buffer.from(buf);
    var type = r.headers.get('content-type') || 'image/jpeg';
    wallpaperCache[key] = { data: data, type: type };
    res.setHeader('Content-Type', type);
    res.send(data);
  }); }).catch(function() { res.status(500).end(); });
});

// ── FONT PROXY — tablet has no internet, PC does ─────────────
var fontCssCache = null;
var fontFileCache = {};
var GFONTS_URL = 'https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,300;0,400;0,600;0,700;1,300&family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap';

app.get('/font-css', function(req, res) {
  res.setHeader('Content-Type', 'text/css');
  if (fontCssCache) return res.send(fontCssCache);
  fetch(GFONTS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120' } })
    .then(function(r) { return r.text(); })
    .then(function(css) {
      // rewrite font file URLs to route through this server
      fontCssCache = css.replace(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g, "url('/font-file?u=$1')");
      res.send(fontCssCache);
    })
    .catch(function() { res.status(500).send(''); });
});

app.get('/font-file', function(req, res) {
  var url = req.query.u;
  if (!url || !url.startsWith('https://fonts.gstatic.com')) return res.status(400).end();
  if (fontFileCache[url]) {
    res.setHeader('Content-Type', 'font/woff2');
    return res.send(fontFileCache[url]);
  }
  fetch(url)
    .then(function(r) { return r.arrayBuffer(); })
    .then(function(buf) {
      fontFileCache[url] = Buffer.from(buf);
      res.setHeader('Content-Type', 'font/woff2');
      res.send(fontFileCache[url]);
    })
    .catch(function() { res.status(500).end(); });
});

app.listen(PORT, '0.0.0.0', function() {
  console.log('');
  console.log('  LOFI DASHBOARD SERVER v3 RUNNING');
  console.log('  Open on tablet: http://192.168.1.13:' + PORT);
  console.log('  Last.fm: ' + LASTFM_USERNAME);
  console.log('  Press Ctrl+C to stop');
  console.log('');
});
