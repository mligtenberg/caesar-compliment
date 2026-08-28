import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { IPublicClientApplication, InteractionType } from '@azure/msal-browser';
import { MsalModule, MsalGuardConfiguration } from '@azure/msal-angular';
import { appRoutes } from './app.routes';
import { loginRequest } from './auth-config';

const guardConfig: MsalGuardConfiguration = {
  interactionType: InteractionType.Redirect,
  authRequest: loginRequest,
};

export function createAppConfig(msalInstance: IPublicClientApplication): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(appRoutes),
      importProvidersFrom(
        MsalModule.forRoot(msalInstance, guardConfig, {
          interactionType: InteractionType.Redirect,
          protectedResourceMap: new Map(),
        })
      ),
    ]
  };
}
