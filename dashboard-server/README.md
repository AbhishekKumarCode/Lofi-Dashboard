# Lofi Dashboard — Setup Guide

## Your folder should look like this
```
C:\dashboard-server\
  ├── server.js            ← PC server (runs in background)
  ├── index.html           ← the dashboard (open on tablet)
  ├── start-dashboard.bat  ← double-click to start everything
  └── README.md            ← this file
```

---

## Step 1 — Edit your PC IP in index.html
Open index.html in Notepad.
Find this line near the bottom:
  const SERVER = "http://192.168.1.5:3000";
Replace 192.168.1.5 with your actual PC IP.
Find your IP: open terminal → type ipconfig → look for IPv4 Address.

---

## Step 2 — Start the server
Double-click start-dashboard.bat
First time: it auto-installs packages (takes 1 minute)
After that: server starts immediately

---

## Step 3 — Open on tablet
Make sure tablet is on same WiFi as PC.
Open browser on tablet.
Type:  http://YOUR_PC_IP:3000
Set it as homepage.

---

## Step 4 — Auto start on PC boot
Press Win + R
Type:  shell:startup
Press Enter
Drag a SHORTCUT of start-dashboard.bat into that folder
Right-click shortcut → Properties → Run → Minimized

---

## Step 5 — Tablet stays awake
Settings → About Tablet → tap Build Number 7 times
Settings → Developer Options → enable Stay Awake

---

## Troubleshooting

Dashboard shows "server offline"
  → Make sure start-dashboard.bat is running on PC
  → Make sure tablet and PC are on same WiFi
  → Check your IP address didn't change (set DHCP reservation in router)

Spotify shows "nothing playing"  
  → Make sure Spotify desktop app is open on your PC
  → Play any song — title should appear within 3 seconds
  → Spotify must be the DESKTOP app, not browser version

Controls not working
  → This uses keyboard shortcuts sent to Spotify window
  → Spotify desktop app must be open (can be minimized)
  → Won't work if Spotify is open in browser

Weather showing wrong city
  → Open server.js in Notepad
  → Find WEATHER_LAT and WEATHER_LON
  → Go to latlong.net to find your city coordinates
  → Replace the numbers and restart server

---

## Ports used
3000 → dashboard + API (make sure Windows Firewall allows this)
If firewall blocks it: Windows Security → Firewall → Allow an app → add node.exe
