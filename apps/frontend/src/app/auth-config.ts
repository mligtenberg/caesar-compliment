import {
  BrowserCacheLocation,
  Configuration,
  LogLevel,
} from '@azure/msal-browser';
import { environment } from '../environments/environment';

export const msalConfig: Configuration = {
  auth: {
    clientId: environment.entra.clientId,
    authority: `https://login.microsoftonline.com/${environment.entra.tenantId}`,
    redirectUri: environment.entra.redirectUri,
    postLogoutRedirectUri: environment.entra.redirectUri,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read'],
};

export const apiRequest = {
  scopes: [environment.api.scope],
};
