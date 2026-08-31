import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';
import { ApiKeyService } from './api-key.service';

export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.api.baseUrl)) {
    return next(req);
  }

  const apiKey = inject(ApiKeyService).value;
  if (!apiKey) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Api-Key': apiKey } }));
};
