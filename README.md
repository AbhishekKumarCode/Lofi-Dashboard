# 🌙 Lofi Dashboard

> A handcrafted ambient dashboard that turns an old Android tablet into a always-on lofi command center — displaying live Spotify, weather, PC health, ASCII art, and a cozy visualizer. Built entirely from scratch with vanilla JS, Node.js, and zero frameworks.

<p align="center">
  <img src="icon-512.png" width="120" alt="Lofi Dashboard Icon"/>
</p>

---

## ✨ Features

- **🎵 Live Spotify Now Playing** — real-time song, artist, album art and smooth progress bar via Last.fm scrobbling
- **🌤 Live Weather** — current temperature, conditions, humidity and wind for your city via Open-Meteo (no API key needed)
- **📅 5-Day Forecast** — live week-ahead weather with animated temperature bars
- **💻 PC Health Monitor** — real-time CPU, RAM, GPU and temperature stats
- **🐱 ASCII Cat Animations** — 14 hand-crafted ASCII cats including Nyan Cat, Grumpy Cat, Pop Cat, Keyboard Cat and more, each with unique animation speeds
- **🎨 ASCII Music Visualizer** — colorful per-column animated visualizer that reacts to playback state
- **⏱ Pomodoro Timer** — focus timer with start/pause/reset
- **🌦 Rain Effect** — ambient animated rain overlay
- **✏️ Quick Note** — persistent scratchpad
- **💭 Rotating Quotes** — lofi inspirational quotes that cycle automatically
- **🚀 Auto Boot** — tablet launches dashboard on power-on, server auto-starts on PC boot

---

## 🏗 Architecture

```
┌─────────────────────┐         WiFi          ┌──────────────────────┐
│   Android Tablet    │ ◄──────────────────── │      Windows PC      │
│                     │                        │                      │
│  Lofi Dashboard APK │                        │  Node.js Server      │
│  (WebView Kiosk)    │    HTTP/JSON API        │  ├── Last.fm API     │
│                     │ ──────────────────────► │  ├── Open-Meteo API  │
│  index.html         │                        │  ├── PC Stats        │
│  Vanilla JS / CSS   │                        │  └── Spotify Control │
└─────────────────────┘                        └──────────────────────┘
```

**No frameworks. No React. No Vue. Just vanilla HTML/CSS/JS.**

The entire frontend is ES5-compatible to support Android 7's old WebView engine.

---

## 📁 Project Structure

```
LofiDashboard/
├── 📱 Android APK (this repo)
│   ├── app/src/main/java/com/lofidashboard/
│   │   ├── MainActivity.java        # WebView kiosk wrapper
│   │   └── BootReceiver.java        # Auto-launch on boot
│   └── .github/workflows/build.yml  # Auto-builds APK via GitHub Actions
│
└── 🖥 PC Server (dashboard-server/)
    ├── server.js          # Express API — weather, stats, Spotify
    ├── index.html         # The entire dashboard UI
    ├── manifest.json      # PWA manifest
    └── start-dashboard.bat # One-click server start
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5 / CSS3 / ES5 JavaScript |
| Backend | Node.js + Express |
| Spotify | Last.fm Scrobbling API |
| Weather | Open-Meteo API (free, no key) |
| PC Stats | systeminformation (npm) |
| Android | Native WebView + Java |
| CI/CD | GitHub Actions |
| Fonts | Josefin Sans · Lora · Courier Prime |

---

## 🚀 Setup Guide

### Prerequisites
- Windows PC
- Node.js installed ([nodejs.org](https://nodejs.org))
- Android tablet (Android 5.0+)
- Last.fm account connected to Spotify ([last.fm](https://last.fm))

### PC Server Setup

```bash
# 1. Clone the repo or download dashboard-server folder
cd dashboard-server

# 2. Install dependencies
npm install

# 3. Edit server.js — set your Last.fm username
const LASTFM_USERNAME = 'your-username';

# 4. Edit index.html — set your PC's IP address
const SERVER = "http://YOUR_PC_IP:3000";

# 5. Start the server
start-dashboard.bat   # Windows
# or
node server.js
```

### Find your PC IP
```bash
ipconfig   # Windows — look for IPv4 Address
```

### Tablet Setup
1. Install the APK on your Android tablet
2. Grant internet permissions
3. The app auto-connects to your PC server
4. Enable **Stay Awake** in Developer Options for always-on display

### Auto-start on PC Boot
1. Press `Win + R` → type `shell:startup`
2. Drop a shortcut to `start-dashboard.bat` in the folder
3. Right-click shortcut → Properties → Run → **Minimized**

---

## 📦 Building the APK

The APK is built automatically via GitHub Actions on every push.

1. Push to `main` branch
2. Go to **Actions** tab
3. Download **LofiDashboard-APK** artifact
4. Transfer `.apk` to tablet and install

---

## 🎨 Design System

```
Background:  #080610  (deep dark purple-black)
Primary:     #a78bfa  (soft lavender)
Secondary:   #f9a8d4  (pastel pink)
Accent:      #6ee7b7  (mint green)
Warm:        #fcd34d  (soft yellow)
Text:        #ede8f5  (off-white)
```

**Fonts:**
- **Josefin Sans** — UI, body text (airy, geometric)
- **Lora** italic — artist names, quotes, dates (romantic serif)
- **Courier Prime** — clock, stats, labels (vintage typewriter)

---

## 🐱 ASCII Cats

14 hand-crafted ASCII cat animations — each with unique personality and animation speed:

| Cat | Vibe | Speed |
|-----|------|-------|
| Nyan Cat ★ | Rainbow trail | 180ms |
| Pop Cat | Open/close mouth | 200ms |
| Keyboard Cat | Plays ♪ notes | 250ms |
| Monorail Cat | Slides across | 200ms |
| Grumpy Cat | Just says NO | 650ms |
| Ceiling Cat | Watching you | 600ms |
| Smudge Cat | Confused at table | 600ms |
| Business Cat | Deal with it | 700ms |
| Longcat | He is very long | 400ms |
| + 5 more... | | |

---

## 💡 Why I Built This

I had an old **Lenovo Tab 7 Essential** (1GB RAM, Android 7, cracked screen) collecting dust. Instead of throwing it away, I turned it into a permanent ambient display for my desk.

The challenge was making everything work on **1GB RAM with Android 7's old WebView** — no modern JS features, no canvas animations, no heavy frameworks. Everything had to be lightweight, ES5-compatible, and smooth.

The result is a dashboard that genuinely improves my workflow while looking beautiful on the desk.

---

## 📄 License

MIT — use it, modify it, make it yours.

---

<p align="center">
  Made with ☕ and late nights &nbsp;|&nbsp; <i>"the quieter you become, the more you can hear."</i>
</p>
