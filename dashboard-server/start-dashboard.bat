@echo off
title Lofi Dashboard Server
color 0D

echo.
echo  ================================
echo   LOFI DASHBOARD SERVER STARTING
echo  ================================
echo.
echo  Keep this window open (or minimized)
echo  Press Ctrl+C to stop the server
echo.

:: ============================================================
::  EDIT THIS LINE if your dashboard folder is somewhere else
::  Default: C:\dashboard-server
:: ============================================================
cd /d C:\dashboard-server

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERROR: Node.js not found!
  echo  Download it from https://nodejs.org
  echo.
  pause
  exit
)

:: Check if node_modules exists, if not run npm install first
if not exist "node_modules" (
  echo  First run detected — installing packages...
  echo  This only happens once, please wait...
  echo.
  npm install express node-fetch systeminformation
  echo.
  echo  Packages installed! Starting server...
  echo.
)

:: Start the server
node server.js

:: If server crashes, wait before closing
echo.
echo  Server stopped. Press any key to restart or close this window.
pause >nul
start "" "%~f0"
