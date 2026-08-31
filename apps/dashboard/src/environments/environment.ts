// Production environment. Values below are tokenization placeholders —
// a CI/CD release pipeline (e.g. Azure DevOps "Replace Tokens" / colon-hash
// syntax) must substitute these with real values at deploy time.
export const environment = {
  production: true,
  api: {
    baseUrl: '#{API_BASE_URL}#',
  },
};
