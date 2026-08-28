using 'main.bicep'

param environmentName = 'dev'
param appServicePlanSku = 'B1'
param staticWebAppSku = 'Free'
param staticWebAppLocation = 'westeurope'
param additionalCorsAllowedOrigins = [
  'http://localhost:4200'
]
