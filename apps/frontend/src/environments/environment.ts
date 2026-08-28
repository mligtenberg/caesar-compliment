// Production environment. Values below are tokenization placeholders —
// a CI/CD release pipeline (e.g. Azure DevOps "Replace Tokens" / colon-hash
// syntax) must substitute these with real values at deploy time.
export const environment = {
  production: true,
  entra: {
    clientId: '#{ENTRA_CLIENT_ID}#',
    tenantId: '#{ENTRA_TENANT_ID}#',
    redirectUri: '#{ENTRA_REDIRECT_URI}#',
  },
  api: {
    baseUrl: '#{API_BASE_URL}#',
    scope: '#{API_SCOPE}#',
  },
};
