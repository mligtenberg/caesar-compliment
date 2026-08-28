// Development environment. Replace with your own Entra app registration
// (or a shared dev registration) to be able to sign in locally.
export const environment = {
  production: false,
  entra: {
    clientId: 'ccbc9608-8ef7-4c52-8df8-f87640818ae3',
    tenantId: '4c64df47-4722-4fe4-9834-f082c8d10a0c',
    redirectUri: 'http://localhost:4200',
  },
  api: {
    baseUrl: 'http://localhost:5041',
    scope: 'api://<backend-app-registration-client-id>/access_as_user',
  },
};
