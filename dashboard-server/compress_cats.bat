@echo off
title Cat GIF Compressor
color 0D
echo.
echo  ================================
echo   CAT GIF COMPRESSOR
echo   Making your GIFs run smoother
echo  ================================
echo.

cd /d C:\dashboard-server

:: Check if Python is installed
where python >nul 2>&1
if %errorlevel% neq 0 (
  echo  Python not found! Install from python.org
  echo  Or install via Microsoft Store - search "Python 3"
  pause
  exit
)

:: Install Pillow if needed
echo  Checking Pillow library...
python -c "from PIL import Image" >nul 2>&1
if %errorlevel% neq 0 (
  echo  Installing Pillow...
  python -m pip install Pillow
)

echo.
echo  Starting compression...
echo.
python compress_cats.py

pause
