# Infrastructure

Bicep templates provisioning the Azure resources for `backend`, `frontend`, and `dashboard`:

- Log Analytics workspace
- Application Insights (workspace-based)
- Linux App Service Plan
- Linux App Service (`DOTNETCORE|10.0`) with system-assigned managed identity, hosting the `backend` API
- Two Static Web Apps (`provider: None`, deployed via CLI/CI rather than a linked GitHub repo), hosting the `frontend` and the `dashboard`

The backend's CORS is automatically opened to both Static Web Apps' URLs, plus any origins listed in `additionalCorsAllowedOrigins`.

## Deploy

```bash
az deployment group create \
  --resource-group <your-resource-group> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

Override `environmentName`, `appServicePlanSku`, `staticWebAppSku`, `staticWebAppLocation`, or `additionalCorsAllowedOrigins` by editing `main.bicepparam` or passing `--parameters` on the CLI.

## Deploying the frontend/dashboard builds

The Static Web Apps are created with no linked source provider, so pushing the built `frontend`/`dashboard` apps is done out-of-band, e.g. with the [SWA CLI](https://azure.github.io/static-web-apps-cli/):

```bash
swa deploy dist/apps/frontend/browser \
  --deployment-token <token from `az staticwebapp secrets list` for the frontend app>

swa deploy dist/apps/dashboard/browser \
  --deployment-token <token from `az staticwebapp secrets list` for the dashboard app>
```

## CI/CD

`.github/workflows/ci-cd.yml` builds and tests all three apps on every push/PR, and on pushes to `main` also deploys infra + all three apps. It authenticates to Azure via OIDC (no stored client secret), so the Azure AD app registration used for login needs a federated credential for this repo's `main` branch.

Required repository **secrets**:

| Secret                   | Purpose                                            |
| ------------------------ | --------------------------------------------------- |
| `AZURE_CLIENT_ID`        | App registration used for OIDC login                |
| `AZURE_TENANT_ID`        | Entra tenant ID                                     |
| `AZURE_SUBSCRIPTION_ID`  | Target subscription                                 |

Required repository **variables**:

| Variable                  | Purpose                                                        |
| -------------------------- | --------------------------------------------------------------- |
| `AZURE_RESOURCE_GROUP`     | Resource group the infra is deployed into                       |
| `AZURE_ENVIRONMENT_NAME`   | Passed as `environmentName` to `main.bicep` (defaults to `prod`) |

The login principal needs `Contributor` on the resource group (to run the Bicep deployment and deploy the App Service/Static Web App content).
