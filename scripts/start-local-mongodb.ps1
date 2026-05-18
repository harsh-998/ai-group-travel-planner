$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$bundledMongod = Join-Path $workspaceRoot "tools\mongodb\mongodb-win32-x86_64-windows-7.0.22\bin\mongod.exe"
$dbPath = Join-Path $env:LOCALAPPDATA "WayFinder\mongo-data"
$logPath = Join-Path $dbPath "mongod.log"

function Test-MongoPort {
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $async = $client.BeginConnect("127.0.0.1", 27017, $null, $null)
        if (!$async.AsyncWaitHandle.WaitOne(1000)) {
            $client.Close()
            return $false
        }
        $client.EndConnect($async)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

if (Test-Path $bundledMongod) {
    $mongod = $bundledMongod
} else {
    $mongodCommand = Get-Command "mongod" -ErrorAction SilentlyContinue
    if ($mongodCommand) {
        $mongod = $mongodCommand.Source
    }
}

if (!$mongod) {
    throw "mongod.exe was not found. Install MongoDB Community Server or place the bundled MongoDB tools at $bundledMongod"
}

New-Item -ItemType Directory -Force -Path $dbPath | Out-Null

if (Test-MongoPort) {
    Write-Host "MongoDB is already listening on 127.0.0.1:27017"
    return
}

$arguments = "--dbpath `"$dbPath`" --bind_ip 127.0.0.1 --port 27017 --logpath `"$logPath`" --logappend"
Start-Process -FilePath $mongod -ArgumentList $arguments -WindowStyle Hidden

Start-Sleep -Seconds 5

if (!(Test-MongoPort)) {
    throw "MongoDB did not start. Check $logPath"
}

Write-Host "MongoDB started on 127.0.0.1:27017"
