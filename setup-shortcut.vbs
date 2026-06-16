' RIVER-WALL ERP V.5.0 — Crear acceso directo en el escritorio
' Ejecutar con doble clic para generar el icono

Dim shell, fso, desktop, shortcutPath, targetPath, iconPath, currentDir

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = shell.SpecialFolders("Desktop")
shortcutPath = desktop & "\RIVER-WALL ERP V.5.0.lnk"
targetPath = currentDir & "\launcher.vbs"
iconPath = currentDir & "\icon-512.png"

' Verificar que los archivos existen
If Not fso.FileExists(targetPath) Then
    MsgBox "Error: No se encuentra launcher.vbs" & vbCrLf & targetPath, vbCritical, "RIVER-WALL ERP V.5.0"
    WScript.Quit 1
End If

If Not fso.FileExists(iconPath) Then
    iconPath = ""  ' Sin icono personalizado
End If

' Crear el acceso directo
Dim shortcut
Set shortcut = shell.CreateShortcut(shortcutPath)

shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & targetPath & """"
shortcut.WorkingDirectory = currentDir
shortcut.Description = "RIVER-WALL ERP V.5.0 — D-WALL S.L."
shortcut.WindowStyle = 7  ' Minimizado (no se ve)

If iconPath <> "" Then
    shortcut.IconLocation = iconPath & ", 0"
End If

shortcut.Save()

MsgBox "Acceso directo creado en el escritorio:" & vbCrLf & vbCrLf & _
       "RIVER-WALL ERP V.5.0.lnk" & vbCrLf & vbCrLf & _
       "Haz doble clic en el icono para iniciar la aplicación.", _
       vbInformation, "RIVER-WALL ERP V.5.0 — Instalación completada"
