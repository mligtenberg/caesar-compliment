targetScope = 'resourceGroup'

@description('Environment name used to derive resource names (e.g. dev, prod)')
param environmentName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('SKU for the App Service Plan')
param appServicePlanSku string = 'P0v4'

@description('SKU for the Static Web App')
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSku string = 'Free'

@description('Location for the Static Web App (only available in a subset of regions, e.g. westeurope)')
param staticWebAppLocation string = 'westeurope'

@description('Custom domain to bind to the main Static Web App. Leave empty to skip. Requires a CNAME record pointing at the app default hostname to already exist for validation to succeed.')
param staticWebAppCustomDomain string = ''

@description('Additional CORS origins to allow on the backend API, beyond the deployed frontend URL')
param additionalCorsAllowedOrigins array = []

@description('Entra ID tenant ID shared by all app registrations - same tenant used for local development, see config/local.json')
param entraTenantId string = 'c53567a1-4f5a-4d88-a3a4-c20d15cca883'

@description('Client ID of the backend app registration, used to validate incoming access tokens - same app registration used for local development, see config/local.json')
param entraClientId string = '88edd827-531c-4044-852c-8cc8fe493c63'

@secure()
@description('Shared key the dashboard uses to call the backend /external endpoints (see ApiKeyAuthenticationHandler). Leave empty to disable that integration.')
param backendApiKey string = ''

var resourceToken = toLower('${environmentName}')
var storageAccountName = toLower('stcaesarcompl${resourceToken}')
var tags = {
  environment: environmentName
  application: 'caesar-compliment'
}

module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'log-analytics'
  params: {
    name: 'log-caesar-compliment-${resourceToken}'
    location: location
    tags: tags
  }
}

module appInsights 'modules/app-insights.bicep' = {
  name: 'app-insights'
  params: {
    name: 'appi-caesar-compliment-${resourceToken}'
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.id
    tags: tags
  }
}

module appServicePlan 'modules/app-service-plan.bicep' = {
  name: 'app-service-plan'
  params: {
    name: 'asp-caesar-compliment-${resourceToken}'
    location: location
    skuName: appServicePlanSku
    tags: tags
  }
}

module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'static-web-app'
  params: {
    name: 'stapp-caesar-compliment-${resourceToken}'
    location: staticWebAppLocation
    skuName: staticWebAppSku
    tags: tags
    //customDomainName: staticWebAppCustomDomain
  }
}

module dashboardStaticWebApp 'modules/static-web-app.bicep' = {
  name: 'dashboard-static-web-app'
  params: {
    name: 'stapp-caesar-compliment-dashboard-${resourceToken}'
    location: staticWebAppLocation
    skuName: staticWebAppSku
    tags: tags
  }
}

module webApp 'modules/web-app.bicep' = {
  name: 'web-app'
  params: {
    name: 'app-caesar-complimentje-${resourceToken}'
    location: location
    appServicePlanId: appServicePlan.outputs.id
    appInsightsConnectionString: appInsights.outputs.connectionString
    corsAllowedOrigins: concat(
      [
        'https://${staticWebApp.outputs.defaultHostName}'
        'https://${dashboardStaticWebApp.outputs.defaultHostName}'
      ],
      additionalCorsAllowedOrigins
    )
    storageAccountName: storageAccountName
    frontendOrigin: 'https://${staticWebApp.outputs.defaultHostName}'
    dashboardOrigin: 'https://${dashboardStaticWebApp.outputs.defaultHostName}'
    entraTenantId: entraTenantId
    entraClientId: entraClientId
    apiKey: backendApiKey
    tags: tags
  }
}

module storageAccount 'modules/storage-account.bicep' = {
  name: 'storage-account'
  params: {
    name: storageAccountName
    location: location
    tableDataContributorPrincipalId: webApp.outputs.principalId
    blobDataReaderPrincipalId: webApp.outputs.principalId
    tags: tags
  }
}

output backendUrl string = 'https://${webApp.outputs.defaultHostName}'
output backendName string = webApp.outputs.name
output frontendUrl string = 'https://${staticWebApp.outputs.defaultHostName}'
output frontendName string = staticWebApp.outputs.name
output dashboardUrl string = 'https://${dashboardStaticWebApp.outputs.defaultHostName}'
output dashboardName string = dashboardStaticWebApp.outputs.name
