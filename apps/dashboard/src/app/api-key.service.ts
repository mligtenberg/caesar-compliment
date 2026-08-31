import { Injectable } from '@angular/core';

// The dashboard has no sign-in flow - it authenticates to the backend's
// /external endpoints with a shared key passed as a query param, e.g.
// https://dashboard.example.com/?api_key=... (see backend: ApiKeyAuthenticationHandler).
@Injectable({ providedIn: 'root' })
export class ApiKeyService {
  readonly value = new URLSearchParams(window.location.search).get('api_key');
}
