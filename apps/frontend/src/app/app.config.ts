import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import {HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi} from '@angular/common/http';
import {
  IPublicClientApplication,
  InteractionType,
} from '@azure/msal-browser';
import {
  MsalGuardConfiguration,
  MsalInterceptor,
  MsalInterceptorConfiguration,
  MSAL_INTERCEPTOR_CONFIG, MSAL_INSTANCE, MSAL_GUARD_CONFIG, MsalService, MsalGuard, MsalBroadcastService,
} from '@azure/msal-angular';
import { appRoutes } from './app.routes';
import { environment } from '../environments/environment';

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();
  protectedResourceMap.set(
    `${environment.api.baseUrl}/*`,
    [environment.api.scope]
  );

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}

export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: {
      scopes: [environment.api.scope],
    },
    loginFailedRoute: '/login-failed',
  };
}

export function createAppConfig(msalInstance: IPublicClientApplication): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(appRoutes),
      provideHttpClient(withInterceptorsFromDi(), withFetch()),
      {
        provide: HTTP_INTERCEPTORS,
        useClass: MsalInterceptor,
        multi: true,
      },
      {
        provide: MSAL_INSTANCE,
        useValue: msalInstance,
      },
      {
        provide: MSAL_GUARD_CONFIG,
        useFactory: MSALGuardConfigFactory,
      },
      {
        provide: MSAL_INTERCEPTOR_CONFIG,
        useFactory: MSALInterceptorConfigFactory,
      },
      MsalService,
      MsalGuard,
      MsalBroadcastService,
    ]
  };
}
