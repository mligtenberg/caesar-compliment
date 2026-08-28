import { bootstrapApplication } from '@angular/platform-browser';
import { PublicClientApplication } from '@azure/msal-browser';
import { createAppConfig } from './app/app.config';
import { msalConfig } from './app/auth-config';
import { App } from './app/app';

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise())
  .then(() => bootstrapApplication(App, createAppConfig(msalInstance)))
  .catch((err) => console.error(err));
