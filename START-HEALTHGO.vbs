Set shell = CreateObject("WScript.Shell")

shell.Run "cmd /c cd /d ""C:\Users\Marcel\Desktop\HealthGo"" && node healthgo-ai-server.mjs", 0, False

WScript.Sleep 3000

shell.Run "http://127.0.0.1:5500/www/index.html", 1, False