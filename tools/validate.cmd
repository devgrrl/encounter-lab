@echo off
setlocal
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0validate.ps1" %*
exit /b %ERRORLEVEL%