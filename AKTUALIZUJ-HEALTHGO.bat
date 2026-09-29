@echo off
title HealthGo - Aktualizacja
cd /d "%~dp0"

echo ==========================================
echo          HEALTHGO - AKTUALIZACJA
echo ==========================================
echo.

echo [1/4] Zamykanie starego HealthGo...
taskkill /F /IM HealthGo.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

echo GOTOWE
echo.

echo [2/4] Usuwanie starego folderu dist...
if exist "dist" (
    rmdir /s /q "dist"
)

echo GOTOWE
echo.

echo [3/4] Budowanie nowego HealthGo...
echo To moze chwile potrwac.
echo.

call npm run dist

if errorlevel 1 (
    echo.
    echo ==========================================
    echo             BLAD BUDOWANIA
    echo ==========================================
    echo.
    echo Nie zamykaj tego okna.
    echo Zrob zdjecie bledu i wyslij je do ChatGPT.
    echo.
    pause
    exit /b
)

echo.
echo [4/4] Sprawdzanie HealthGo.exe...

if not exist "dist\HealthGo.exe" (
    echo.
    echo ==========================================
    echo BLAD: NIE ZNALEZIONO HEALTHGO.EXE
    echo ==========================================
    echo.
    pause
    exit /b
)

echo.
echo ==========================================
echo          HEALTHGO JEST GOTOWE!
echo ==========================================
echo.
echo Uruchamiam nowa wersje...
echo.

start "" "%~dp0dist\HealthGo.exe"

timeout /t 3 /nobreak >nul

exit