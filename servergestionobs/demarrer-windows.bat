@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Serveur relais OBS
cd /d "%~dp0"

if "%PORT%"=="" (set "RELAY_PORT=8787") else (set "RELAY_PORT=%PORT%")

echo ========================================================
echo   Serveur relais OBS - demarrage
echo ========================================================
echo.

REM ---------------------------------------------------------
REM 1/4 - Node.js est-il installe ?
REM ---------------------------------------------------------
echo [1/4] Verification de Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [ERREUR] Node.js n'est pas installe, ou pas accessible.
    echo   -^> Telechargez et installez la version LTS ici :
    echo      https://nodejs.org/
    echo   Une fois installe, redemarrez votre PC si l'installation
    echo   vient d'etre faite, puis relancez ce script.
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo   OK - Node.js detecte ^(version %NODE_VERSION%^)
echo.

REM ---------------------------------------------------------
REM 2/4 - Le script est-il lance en mode administrateur ?
REM ---------------------------------------------------------
echo [2/4] Verification des droits d'execution...
net session >nul 2>&1
if errorlevel 1 (
    echo   [INFO] Ce script n'est PAS lance en mode administrateur.
    echo   Ce n'est pas bloquant : le serveur peut demarrer normalement.
    echo   Cela peut seulement poser probleme si :
    echo    - Windows n'a jamais demande d'autoriser Node.js sur le
    echo      pare-feu ^(les autres PC du reseau ne pourraient alors
    echo      pas se connecter^)
    echo    - une erreur "acces refuse" apparait au demarrage du serveur
    echo   Si l'un de ces cas se produit : fermez cette fenetre, puis
    echo   clic droit sur "demarrer-windows.bat" -^> "Executer en tant
    echo   qu'administrateur", et acceptez l'alerte du pare-feu Windows.
) else (
    echo   OK - Script lance en mode administrateur.
)
echo.

REM ---------------------------------------------------------
REM 3/4 - Le port est-il deja utilise ?
REM ---------------------------------------------------------
echo [3/4] Verification du port %RELAY_PORT%...
set "PORT_BUSY="
for /f "tokens=5" %%p in ('netstat -aon ^| findstr /r /c:":%RELAY_PORT% .*LISTENING"') do set "PORT_BUSY=%%p"
if defined PORT_BUSY (
    echo   [INFO] Le port %RELAY_PORT% est deja utilise ^(processus PID !PORT_BUSY!^).
    echo   C'est peut-etre parce qu'un serveur relais tourne deja dans
    echo   une autre fenetre : dans ce cas, vous pouvez simplement
    echo   ouvrir http://localhost:%RELAY_PORT%/ dans votre navigateur
    echo   sans relancer de deuxieme serveur.
    echo   Sinon, changez de port avec :  set PORT=9000 ^&^& demarrer-windows.bat
    echo.
    choice /c ON /n /m "Continuer quand meme et essayer de demarrer (O) ou annuler (N) ? "
    if errorlevel 2 (
        echo Annule.
        pause
        exit /b 1
    )
) else (
    echo   OK - Port %RELAY_PORT% disponible.
)
echo.

REM ---------------------------------------------------------
REM 4/4 - Demarrage du serveur
REM ---------------------------------------------------------
echo [4/4] Demarrage du serveur relais...
echo ^(Laissez cette fenetre ouverte tant que vous diffusez^)
echo.
node sync-relay-server.js
if errorlevel 1 (
    echo.
    echo Une erreur est survenue. Verifiez que Node.js est bien installe : https://nodejs.org/
    pause
)
