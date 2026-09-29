$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"
$password = "Password123!"
$temp = Join-Path ([System.IO.Path]::GetTempPath()) "swms-smoke"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

function Invoke-ApiJson([string[]]$curlArgs) {
    $output = & curl.exe -sS @curlArgs
    if ($LASTEXITCODE -ne 0) { throw "curl failed with exit code $LASTEXITCODE" }
    return (($output -join "`n") | ConvertFrom-Json)
}

function Invoke-Status([string[]]$curlArgs) {
    $bodyPath = Join-Path $temp "status-body.txt"
    $status = (& curl.exe -sS @curlArgs --output $bodyPath --write-out "%{http_code}")
    if ($LASTEXITCODE -ne 0) { throw "curl failed with exit code $LASTEXITCODE" }
    $statusText = ($status -join "").Trim()
    return [int]$statusText
}

function Write-Utf8([string]$path, [string]$content) {
    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

function Get-HttpStatus([string]$url, [string]$method, [hashtable]$headers, [string]$body) {
    try {
        $requestArgs = @{ UseBasicParsing = $true; Uri = $url; Method = $method; Headers = $headers }
        if ($body) { $requestArgs.ContentType = "application/json"; $requestArgs.Body = $body }
        return [int](Invoke-WebRequest @requestArgs).StatusCode
    }
    catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode.value__ }
        throw
    }
}

function Invoke-NativeJson([string]$url, [string]$method, [hashtable]$headers, [string]$body) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -Method $method -Headers $headers -ContentType "application/json" -Body $body
    return ($response.Content | ConvertFrom-Json)
}

function Wait-ForStatus([string]$url, [string]$token, [string[]]$expectedStatuses, [int]$timeoutSeconds = 15) {
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    do {
        $response = Invoke-ApiJson @($url, "-H", "Authorization: Bearer $token")
        $value = $response.data
        if ($expectedStatuses -contains $value.status) { return $value }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    return $value
}

Write-Host "== 1. Health check =="
$health = Invoke-ApiJson @("$base/health")
if ($health.data.status -ne "ok") { throw "Health check failed" }

Write-Host "== 2. Login as planner =="
$plannerLogin = Invoke-NativeJson "$base/api/auth/login" "POST" @{} (@{ email = "planner@swms.dev"; password = $password } | ConvertTo-Json -Compress)
$plannerToken = $plannerLogin.data.accessToken

Write-Host "== 3. Login as researcher =="
$researcherLogin = Invoke-NativeJson "$base/api/auth/login" "POST" @{} (@{ email = "researcher@swms.dev"; password = $password } | ConvertTo-Json -Compress)
$researcherToken = $researcherLogin.data.accessToken

Write-Host "== 4. Wrong password -> expect 401 =="
if ((Get-HttpStatus "$base/api/auth/login" "POST" @{} '{"email":"planner@swms.dev","password":"wrong"}') -ne 401) { throw "Wrong password did not return 401" }

Write-Host "== 5. Planner creates a habitation =="
$hab = Invoke-NativeJson "$base/api/habitations" "POST" @{ Authorization = "Bearer $plannerToken" } (@{ name = "Smoke Test Ward"; type = "ward"; latitude = 13.35; longitude = 74.79 } | ConvertTo-Json -Compress)
$habId = $hab.data.id

Write-Host "== 6. Researcher create -> expect 403 =="
if ((Get-HttpStatus "$base/api/habitations" "POST" @{ Authorization = "Bearer $researcherToken" } (@{ name = "Should Fail"; type = "village"; latitude = 10; longitude = 76 } | ConvertTo-Json -Compress)) -ne 403) { throw "Researcher create did not return 403" }

Write-Host "== 7-11. Parameter workflows =="
$demo = @{ population = 5000; populationDensityPerSqKm = 1200; growthRatePct = 2.5; floatingPopPct = 10; householdSize = 4.2; literacyPct = 81 } | ConvertTo-Json -Compress
Invoke-NativeJson "$base/api/habitations/$habId/parameters/demography" "PUT" @{ Authorization = "Bearer $plannerToken" } $demo | Out-Null
$updated = @{ population = 5200; populationDensityPerSqKm = 1200; growthRatePct = 2.5; floatingPopPct = 10; householdSize = 4.2; literacyPct = 81 } | ConvertTo-Json -Compress
Invoke-NativeJson "$base/api/habitations/$habId/parameters/demography" "PUT" @{ Authorization = "Bearer $plannerToken" } $updated | Out-Null
Invoke-ApiJson @("$base/api/habitations/$habId/parameters/demography/history", "-H", "Authorization: Bearer $plannerToken") | Out-Null
if ((Get-HttpStatus "$base/api/habitations/$habId/parameters/demography" "PUT" @{ Authorization = "Bearer $plannerToken" } '{"growthRatePct":2.5}') -ne 400) { throw "Missing field did not return 400" }
if ((Get-HttpStatus "$base/api/habitations/$habId/parameters/demography" "PUT" @{ Authorization = "Bearer $researcherToken" } '{"population":9999,"populationDensityPerSqKm":1200}') -ne 403) { throw "Researcher edit did not return 403" }

Write-Host "== 12-14. GeoJSON map layer =="
$geojsonPath = Join-Path $temp "roads.geojson"
Write-Utf8 $geojsonPath '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[74.79,13.35],[74.80,13.36]]}}]}'
$layer = Invoke-ApiJson @("-X", "POST", "$base/api/habitations/$habId/map-layers", "-H", "Authorization: Bearer $plannerToken", "-F", "layerType=road", "-F", "file=@$geojsonPath")
$createdLayer = $null
$layerDeadline = (Get-Date).AddSeconds(15)
do {
    $layers = Invoke-ApiJson @("$base/api/habitations/$habId/map-layers", "-H", "Authorization: Bearer $plannerToken")
    $createdLayer = @($layers.data | Where-Object { $_.id -eq $layer.data.id })[0]
    if ($createdLayer.status -in @("ready", "failed")) { break }
    Start-Sleep -Seconds 1
} while ((Get-Date) -lt $layerDeadline)
if ($createdLayer.status -ne "ready") { throw "GIS layer did not become ready: $($createdLayer.status)" }
Invoke-ApiJson @("$base/api/habitations/$habId/map-layers?overlay=true", "-H", "Authorization: Bearer $plannerToken") | Out-Null

Write-Host "== 15-18. Dataset validation =="
$csvPath = Join-Path $temp "demography_bulk.csv"
Write-Utf8 $csvPath "habitation_id,population,populationDensityPerSqKm,growthRatePct`n$habId,6100,1300,3`n$habId,,1300,3`n$habId,6100,1300,340`n"
$batch = Invoke-ApiJson @("-X", "POST", "$base/api/uploads", "-H", "Authorization: Bearer $plannerToken", "-F", "habitationId=$habId", "-F", "category=demography", "-F", "file=@$csvPath")
$batchStatus = Wait-ForStatus "$base/api/uploads/$($batch.data.id)" $plannerToken @("validated", "partially_validated", "failed")
if ($batchStatus.status -ne "partially_validated") { throw "Dataset status was $($batchStatus.status)" }
Invoke-ApiJson @("$base/api/uploads/$($batch.data.id)/issues", "-H", "Authorization: Bearer $plannerToken") | Out-Null
if ((Invoke-Status @("-X", "POST", "$base/api/uploads", "-H", "Authorization: Bearer $plannerToken", "-F", "habitationId=$habId", "-F", "category=demography", "-F", "file=@$csvPath")) -ne 200) { throw "Duplicate upload did not return 200" }

Write-Host "== 19. Refresh token flow =="
Invoke-NativeJson "$base/api/auth/refresh" "POST" @{} (@{ refreshToken = $plannerLogin.data.refreshToken } | ConvertTo-Json -Compress) | Out-Null
Write-Host "== 20. Unauthenticated request -> expect 401 =="
if ((Get-HttpStatus "$base/api/habitations" "GET" @{} "") -ne 401) { throw "Unauthenticated request did not return 401" }
Write-Host "ALL SMOKE TESTS COMPLETE"
