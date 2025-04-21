
    $regPath = "HKCU:SoftwareMicrosoftWindowsCurrentVersionExplorerAutoplayHandlers"
if (Test-Path $regPath) {
    Set-ItemProperty -Path $regPath -Name "DisableAutoplay" -Value 0
}

    Set-Partition -DiskNumber 1 -PartitionNumber 1 -NewDriveLetter G
    Write-Host "G: drive restored successfully."
  