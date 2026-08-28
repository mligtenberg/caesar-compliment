@description('Name of the Static Web App')
param name string

@description('Location for the resource (Static Web Apps are only available in a subset of regions)')
param location string

@description('SKU for the Static Web App')
@allowed([
  'Free'
  'Standard'
])
param skuName string = 'Free'

@description('Tags to apply to the resource')
param tags object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    provider: 'None'
  }
}

output name string = staticWebApp.name
output defaultHostName string = staticWebApp.properties.defaultHostname
