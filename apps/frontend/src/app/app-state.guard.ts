import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiClientService } from './api-client.service';

// The send flow (recipient search, postcard rack) is only open during the
// "Open" phase. Outside of it, bounce to a placeholder screen instead of
// letting people compose a compliment that can't be sent yet or anymore.
export const appStateGuard: CanActivateFn = async () => {
  const apiClient = inject(ApiClientService);
  const router = inject(Router);

  const state = await apiClient.getAppState();
  if (state === 'Open') return true;

  return router.createUrlTree([state === 'Locked' ? '/locked' : '/receiving']);
};
