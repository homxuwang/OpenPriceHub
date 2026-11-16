@echo off
setlocal
cd /d "%~dp0.."
node scripts\cloudflare.mjs deploy %*
exit /b %errorlevel%
