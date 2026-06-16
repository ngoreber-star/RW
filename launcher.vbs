' RIVER-WALL ERP V.5.0 — Launcher silencioso
' Ejecuta la aplicación Electron sin mostrar ventana CMD

Dim shell, fso, currentDir, cmd

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = currentDir

' npm install silencioso (solo la primera vez)
If Not fso.FolderExists(currentDir & "\node_modules") Then
    shell.Run "cmd /c npm install --loglevel=error 2>nul", 0, True
End If

' Lanzar Electron sin ventana
cmd = "cmd /c npx electron . 2>nul"
shell.Run cmd, 0, False
