@echo off
title Lofi Dashboard
color 0D

echo.
echo  ================================
echo    LOFI DASHBOARD LAUNCHER
echo  ================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERROR: Node.js not found!
  echo  Download it from https://nodejs.org
  echo.
  pause
  exit
)

:: Go to control panel folder
cd /d "%~dp0control-panel"

:: Install dependencies if node_modules is missing
if not exist "node_modules" (
  echo  First launch — installing dependencies...
  echo  This takes about a minute, please wait...
  echo.
  npm install
  echo.
)

echo  Starting Lofi Control Panel...
echo  Server will start automatically inside the app.
echo.
echo  You can minimise this window.
echo.

npm start
