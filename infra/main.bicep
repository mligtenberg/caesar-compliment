targetScope = 'resourceGroup'

@description('Environment name used to derive resource names (e.g. dev, prod)')
param environmentName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('SKU for the App Service Plan')
param appServicePlanSku string = 'B1'

@description('SKU for the Static Web App')
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSku string = 'Free'

@description('Location for the Static Web App (only available in a subset of regions, e.g. westeurope)')
param staticWebAppLocation string = 'westeurope'

@description('Additional CORS origins to allow on the backend API, beyond the deployed frontend URL')
param additionalCorsAllowedOrigins array = []

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
  }
}

module webApp 'modules/web-app.bicep' = {
  name: 'web-app'
  params: {
    name: 'app-caesar-compliment-${resourceToken}'
    location: location
    appServicePlanId: appServicePlan.outputs.id
    appInsightsConnectionString: appInsights.outputs.connectionString
    corsAllowedOrigins: concat(
      ['https://${staticWebApp.outputs.defaultHostName}'],
      additionalCorsAllowedOrigins
    )
    storageAccountName: storageAccountName
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
