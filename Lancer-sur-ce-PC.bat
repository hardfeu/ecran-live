@echo off
title CineLive - serveur local
echo Demarrage de CineLive. Laissez cette fenetre ouverte pendant le partage.
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:8000'"
py -m http.server 8000 --directory "%~dp0"
pause
