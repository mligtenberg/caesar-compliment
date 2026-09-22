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
    // MSAL's own default: tokens live per-tab and die with it, instead of
    // sitting on disk for anyone else on the machine. The trade is that a new
    // tab (or a browser restart) starts with an empty cache and has to go
    // through Entra again.
    cacheLocation: BrowserCacheLocation.SessionStorage,
  },
  system: {
    // How long to wait on the hidden iframe that renews a token silently
    // (default 10s). That iframe needs the Entra session cookie in a
    // third-party context, which Safari blocks outright and Chrome
    // increasingly does - there it can never succeed, and every second spent
    // waiting is a second of spinner before we fall back to a full redirect.
    // Kept at 3s rather than lower: where the cookie *is* available the
    // iframe does a real round trip to Entra and saves the redirect entirely,
    // so cutting it too short would trade a working silent refresh for an
    // unnecessary page reload.
    iframeBridgeTimeout: 3000,
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
