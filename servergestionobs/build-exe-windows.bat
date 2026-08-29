@echo off
chcp 65001 >nul
title OpenPresenter - construire l executable autonome
cd /d "%~dp0"

echo ========================================================
echo   Construction de openpresenter.exe (sans Node a l'usage)
echo ========================================================
echo (Node.js n'est necessaire qu'une fois, pour CONSTRUIRE.
echo  L'exutable obtenu demarre tout seul, comme un logiciel.)
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js est requis pour construire l'exutable.
    echo -^> Installez la version LTS : https://nodejs.org/ puis relancez.
    pause
    exit /b 1
)

echo [1/4] Preparation du paquet applicatif...
node --experimental-sea-config sea-config.json
if errorlevel 1 ( echo Echec de la preparation. & pause & exit /b 1 )

echo [2/4] Copie du moteur Node...
set "NODE_EXE="
for /f "delims=" %%p in ('where node') do set "NODE_EXE=%%p"
if not defined NODE_EXE ( echo node.exe introuvable. & pause & exit /b 1 )
copy /y "%NODE_EXE%" openpresenter.exe >nul
if errorlevel 1 ( echo Copie impossible. & pause & exit /b 1 )

echo [3/4] Injection du serveur dans l'exutable...
REM postject provient de npm : une connexion Internet est necessaire une seule
REM fois (ou installez-le avant : npm install -g postject)
call npx --yes postject openpresenter.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if errorlevel 1 (
    echo Echec de l'injection. Si un avertissement de signature apparait,
    echo lancez d'abord : signtool remove /s openpresenter.exe  puis reessayez.
    pause
    exit /b 1
)

echo [4/4] Nettoyage...
del /q sea-prep.blob >nul 2>&1

echo.
echo ========================================================
echo   OK : openpresenter.exe cree dans ce dossier ^
echo   Double-cliquez dessus pour demarrer la regie :
echo   le navigateur s'ouvre tout seul. Gardez le dossier
echo   complet (pages, js, vendor...) a cote de l'exe :
echo   c'est lui, la regie portable.
echo ========================================================
pause
