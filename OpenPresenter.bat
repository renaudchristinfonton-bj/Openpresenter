@echo off
REM OpenPresenter - lanceur Windows (double-clic).
REM Resout le dossier, trouve un runtime Node.js 20+, puis delegue a app\launcher\launch.mjs.
REM La fenetre reste ouverte a la fin : un demarrage rate doit se lire, pas disparaitre.
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%CD%"
set "NODE="

if exist "%ROOT%\runtime\node.exe" set "NODE=%ROOT%\runtime\node.exe"
if not defined NODE if exist "%ROOT%\runtime\node\node.exe" set "NODE=%ROOT%\runtime\node\node.exe"
if not defined NODE for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE set "NODE=%%i"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE goto :noruntime

set "VERSION="
for /f "usebackq delims=" %%v in (`"%NODE%" -p "process.versions.node" 2^>nul`) do set "VERSION=%%v"
if not defined VERSION goto :brokennode
set "MAJOR="
for /f "tokens=1 delims=." %%a in ("%VERSION%") do set "MAJOR=%%a"
if not defined MAJOR goto :brokennode
echo %MAJOR%| findstr /R "^[0-9][0-9]*$" >nul || goto :brokennode
if %MAJOR% LSS 20 goto :oldruntime

echo.
echo   OpenPresenter demarre dans cette fenetre.
echo   Gardez-la ouverte pendant le culte : la fermer arrete la regie.
echo.
"%NODE%" "%ROOT%\app\launcher\launch.mjs" %*
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" echo   Regie arretee normalement.
if not "%CODE%"=="0" echo   La regie s'est arretee avec le code %CODE% ^(details ci-dessus^).
echo.
pause
exit /b %CODE%

:noruntime
echo.
echo ============================================================
echo    OpenPresenter
echo ============================================================
echo.
echo Node.js est introuvable sur cet ordinateur.
echo.
echo   1. Ouvrez https://nodejs.org/fr dans un navigateur
echo   2. Telechargez la version "LTS" (Windows Installer .msi)
echo   3. Installez-la en laissant les options par defaut
echo   4. Relancez OpenPresenter.bat
echo.
echo Alternative sans installation : copiez node.exe dans runtime\
echo Aucune installation n'est faite sans votre accord.
echo.
pause
exit /b 70

:brokennode
echo.
echo Node.js a ete trouve mais ne repond pas :
echo   %NODE%
echo.
echo Reinstallez Node.js version "LTS" depuis https://nodejs.org/fr
echo ou copiez node.exe dans le dossier runtime\ de ce projet.
echo.
pause
exit /b 70

:oldruntime
echo.
echo OpenPresenter necessite Node.js 20 ou plus recent.
echo Version detectee : %VERSION%
echo Telechargez la version "LTS" sur https://nodejs.org/fr, puis relancez.
echo.
pause
exit /b 70
