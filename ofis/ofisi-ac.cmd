@echo off
rem Ajan Ofisi'ni baslatir ve tarayicida acar. Kapatmak icin bu pencereyi kapat.
title Ajan Ofisi
start "" http://localhost:4317
node "%~dp0server.js"
