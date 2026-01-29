$BaseUrl = "http://localhost:3000/api"
$AdminUserId = 1768504278480  # <-- change to a real user id in db.json

function Call-Api {
     param(
          [string]$Title,
          [string]$Method,
          [string]$Url,
          [hashtable]$Headers = $null,
          [object]$Body = $null
     )

     Write-Host ""
     Write-Host "=============================="
     Write-Host $Title
     Write-Host "$Method $Url"
     Write-Host "=============================="

     try {
          $params = @{
               Method      = $Method
               Uri         = $Url
               ErrorAction = "Stop"
          }
          if ($Headers) { $params.Headers = $Headers }
          if ($Body -ne $null) {
               $params.ContentType = "application/json"
               $params.Body = ($Body | ConvertTo-Json -Depth 20)
          }

          $resp = Invoke-RestMethod @params
          $resp | ConvertTo-Json -Depth 20
     }
     catch {
          # Try to print useful error details
          Write-Host "ERROR:" -ForegroundColor Red
          Write-Host $_.Exception.Message -ForegroundColor Red

          if ($_.Exception.Response) {
               try {
                    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                    $body = $reader.ReadToEnd()
                    if ($body) {
                         Write-Host "Response body:"
                         $body
                    }
               }
               catch { }
          }
     }
}

# Quick ping
Call-Api -Title "HEALTH" -Method "GET" -Url "$BaseUrl/health"

# Users (requires x-user-id)
Call-Api -Title "USERS (Admin header required)" -Method "GET" -Url "$BaseUrl/users" `
     -Headers @{ "x-user-id" = "$AdminUserId" }

# Org tree (all)
Call-Api -Title "ORG TREE (ALL ROOTS)" -Method "GET" -Url "$BaseUrl/apfs-organization/tree"

# Org tree scoped (admin + component match)
Call-Api -Title "ORG TREE (SCOPED)" -Method "GET" -Url "$BaseUrl/apfs-organization/tree/scoped" `
     -Headers @{ "x-user-id" = "$AdminUserId" }

# Forecast list
Call-Api -Title "FORECAST RECORDS (LIST)" -Method "GET" -Url "$BaseUrl/forecast-records" `
     -Headers @{ "x-user-id" = "$AdminUserId" }
