$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $ScriptDir "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LogFile = Join-Path $LogDir "seo_automation_$Stamp.log"
"[$(Get-Date -Format o)] Starting SEO automation" | Tee-Object -FilePath $LogFile
try {
    & "C:\Program Files\nodejs\node.exe" (Join-Path $ScriptDir "seo_automation.mjs") 2>&1 | Tee-Object -FilePath $LogFile -Append
    $exitCode = $LASTEXITCODE
    "[$(Get-Date -Format o)] Finished with exit code $exitCode" | Tee-Object -FilePath $LogFile -Append
    exit $exitCode
} catch {
    "[$(Get-Date -Format o)] Failed: $($_.Exception.Message)" | Tee-Object -FilePath $LogFile -Append
    exit 1
}
