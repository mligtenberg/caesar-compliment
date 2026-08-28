@description('Name of the App Service Plan')
param name string

@description('Location for the resource')
param location string

@description('SKU for the App Service Plan (e.g. B1, P0v3)')
param skuName string = 'B1'

@description('Tags to apply to the resource')
param tags object = {}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: skuName
  }
  properties: {
    reserved: true
  }
}

output id string = appServicePlan.id
