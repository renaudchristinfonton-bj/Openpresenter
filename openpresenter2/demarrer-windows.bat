@echo off
chcp 65001 >nul
setlocal
title OpenPresenter 2
cd /d "%~dp0"
if not defined PORT set "PORT=8788"

echo ========================================================
echo   OpenPresenter 2 - demarrage
echo ========================================================
echo.

echo Verification de Node.js...
where node >nul 2>&1
if errorlevel 1 goto :node_missing
for /f "delims=" %%V in ('node -v') do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=v." %%M in ('node -v') do set "NODE_MAJOR=%%M"
if not defined NODE_MAJOR goto :node_too_old
if %NODE_MAJOR% LSS 20 goto :node_too_old
echo   OK - Node.js detecte - version %NODE_VERSION%
echo.

echo Application : http://localhost:%PORT%/openpresenter2/
echo Laissez cette fenetre ouverte pendant l'utilisation.
echo Pour arreter le serveur, appuyez sur Ctrl+C.
echo.
node server.mjs
if errorlevel 1 (
  echo.
  echo Le serveur s'est arrete avec une erreur. Verifiez si le port %PORT% est deja utilise.
  pause
)
exit /b 0

:node_missing
echo.
echo [ERREUR] Node.js 20 ou plus recent n'est pas installe.
echo Telechargez la version LTS depuis https://nodejs.org/ puis relancez ce fichier.
echo.
pause
exit /b 1

:node_too_old
echo.
echo [ERREUR] OpenPresenter 2 necessite Node.js 20 ou plus recent.
echo Version detectee :
node -v
echo Telechargez la version LTS depuis https://nodejs.org/ puis relancez ce fichier.
echo.
pause
exit /b 1
