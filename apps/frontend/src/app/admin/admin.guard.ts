import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiClientService } from '../api-client.service';

export const adminGuard: CanActivateFn = async () => {
  const apiClient = inject(ApiClientService);
  const router = inject(Router);

  const role = await apiClient.getMyRole();
  return role === 'admin' || router.createUrlTree(['/']);
};
