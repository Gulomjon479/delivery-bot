$subdomain = "delivery-uz-mini-app"
Write-Host "Starting localtunnel with subdomain: $subdomain"
while ($true) {
    npx --yes localtunnel --port 3000 --subdomain $subdomain
    Start-Sleep -Seconds 2
}
