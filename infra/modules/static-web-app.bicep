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

@description('Optional custom domain to bind to the Static Web App (e.g. complimentje.caesar.nl). Leave empty to skip. Requires a CNAME record pointing at the default hostname to already exist for validation to succeed.')
param customDomainName string = ''

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

resource customDomain 'Microsoft.Web/staticSites/customDomains@2023-12-01' = if (!empty(customDomainName)) {
  parent: staticWebApp
  name: customDomainName
}

output name string = staticWebApp.name
output defaultHostName string = staticWebApp.properties.defaultHostname
output allDomainNames string[] = [
  staticWebApp.properties.defaultHostname
  ...(!empty(customDomainName) ? [customDomain!.properties.domainName] : [])
]
