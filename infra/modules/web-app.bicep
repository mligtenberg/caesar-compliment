@description('Name of the Web App')
param name string

@description('Location for the resource')
param location string

@description('Resource ID of the App Service Plan hosting this app')
param appServicePlanId string

@description('Application Insights connection string')
@secure()
param appInsightsConnectionString string

@description('Allowed CORS origins for the frontend')
param corsAllowedOrigins array = []

@description('Name of the Storage Account backing table storage')
param storageAccountName string

@description('Allowed origin for the frontend app, used for the backend\'s own CORS policy (see Program.cs)')
param frontendOrigin string

@description('Allowed origin for the dashboard app, used for the backend\'s own CORS policy (see Program.cs)')
param dashboardOrigin string

@description('Entra ID tenant ID used to validate incoming access tokens')
param entraTenantId string

@description('Client ID of this app registration, used to validate incoming access tokens')
param entraClientId string

@secure()
@description('Shared key the dashboard uses to call the /external endpoints. Graph is authenticated with the system-assigned managed identity instead, so no client secret is ever set here (see Program.cs)')
param apiKey string = ''

@description('Tags to apply to the resource')
param tags object = {}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      cors: {
        allowedOrigins: corsAllowedOrigins
      }
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'Storage__AccountName'
          value: storageAccountName
        }
        {
          name: 'Frontend__Origin'
          value: frontendOrigin
        }
        {
          name: 'Dashboard__Origin'
          value: dashboardOrigin
        }
        {
          name: 'backend__tenantId'
          value: entraTenantId
        }
        {
          name: 'backend__clientId'
          value: entraClientId
        }
        {
          name: 'ApiKey'
          value: apiKey
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

output name string = webApp.name
output defaultHostName string = webApp.properties.defaultHostName
output principalId string = webApp.identity.principalId
