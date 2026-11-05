@echo off
REM OpenPresenter - diagnostic Windows (double-clic).
REM Repond a la question « pourquoi la fenetre se ferme-t-elle ? » sans rien modifier.
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%CD%"

echo.
echo ============================================================
echo    OpenPresenter - diagnostic
echo ============================================================
echo.
echo Dossier        : %ROOT%
echo Date           : %DATE% %TIME%
echo.

echo --- Node.js ---
where node 2>nul
if errorlevel 1 (
  echo   node introuvable dans le PATH
) else (
  node -v
)
if exist "%ROOT%\runtime\node.exe" echo   runtime\node.exe present
if exist "%ROOT%\runtime\node\node.exe" echo   runtime\node\node.exe present
echo.

echo --- Ports 8788 a 8792 ---
netstat -ano | findstr /R ":87[89][0-9] .*LISTENING"
if errorlevel 1 echo   aucun port de la plage n'ecoute
echo.

echo --- Verrou du projet (.lock) ---
if exist "%ROOT%\project\.lock" (
  type "%ROOT%\project\.lock"
) else (
  echo   aucun verrou : le prochain demarrage est libre
)
echo.

echo --- Dernier journal ---
if exist "%ROOT%\project\logs" (
  for /f "delims=" %%f in ('dir /b /o-d "%ROOT%\project\logs\*.log" 2^>nul') do (
    echo   %%~ff
    powershell -NoProfile -Command "Get-Content -Tail 20 -LiteralPath '%ROOT%\project\logs\%%f'" 2>nul
    goto :logs_done
  )
)
echo   aucun journal pour l'instant
:logs_done
echo.
echo ============================================================
echo    Copiez ce texte si vous demandez de l'aide.
echo ============================================================
echo.
pause
