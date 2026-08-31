@description('Name of the Storage Account (must be globally unique, lowercase, 3-24 chars)')
param name string

@description('Location for the resource')
param location string

@description('Principal ID of the identity that should read/write table data')
param tableDataContributorPrincipalId string

@description('Principal ID of the identity that should read blob data (e.g. the recipients CSV)')
param blobDataReaderPrincipalId string

@description('Tags to apply to the resource')
param tags object = {}

// Storage Table Data Contributor - lets the backend's managed identity read/write entities.
var tableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

// Storage Blob Data Reader - lets the backend's managed identity read the recipients CSV.
var blobDataReaderRoleId = '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource complimentsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Compliments'
}

resource tableDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, tableDataContributorPrincipalId, tableDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', tableDataContributorRoleId)
    principalId: tableDataContributorPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

// Holds the recipients CSV (exported from MijnCaesar) that the search/suggestions API reads.
resource recipientsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'recipients'
  properties: {
    publicAccess: 'None'
  }
}

resource blobDataReaderAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, blobDataReaderPrincipalId, blobDataReaderRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataReaderRoleId)
    principalId: blobDataReaderPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output name string = storageAccount.name
