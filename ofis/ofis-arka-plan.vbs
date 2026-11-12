' Ajan Ofisi sunucusunu pencere acmadan baslatir (oturum acilinca Baslangic klasorunden calisir).
' Zaten aciksa sunucu kendiliginden kapanir.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sh.Run "cmd /c node """ & dir & "\server.js"" >> """ & dir & "\server.log"" 2>&1", 0, False
