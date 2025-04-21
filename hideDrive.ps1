
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers" -Name "DisableAutoplay" -Value 1

$DriveLetter = "G"
$Partition = Get-Partition -DriveLetter $DriveLetter

if ($Partition) {
  Remove-PartitionAccessPath -DiskNumber $Partition.DiskNumber -PartitionNumber $Partition.PartitionNumber -AccessPath "G:\"
  Write-Host "G: drive hidden."
} else {
  Write-Host "Partition not found."
}
  