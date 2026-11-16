@echo off
setlocal
cd /d "%~dp0.."
node scripts\cloudflare.mjs init %*
exit /b %errorlevel%
