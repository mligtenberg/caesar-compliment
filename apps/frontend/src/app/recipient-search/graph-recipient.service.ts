import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { apiRequest } from '../auth-config';
import { environment } from '../../environments/environment';
import { Recipient } from './recipient.model';

@Injectable({ providedIn: 'root' })
export class GraphRecipientService {
  private readonly msalService = inject(MsalService);

  async searchRecipients(term: string): Promise<Recipient[]> {
    const accessToken = await this.acquireAccessToken();
    if (!accessToken) return [];

    const trimmed = term.trim();
    const url = `${environment.api.baseUrl}/suggestions?term=${encodeURIComponent(trimmed)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];

    return (await response.json()) as Recipient[];
  }

  private async acquireAccessToken(): Promise<string | undefined> {
    const account = this.msalService.instance.getActiveAccount();
    if (!account) return undefined;
    try {
      const result = await this.msalService.instance.acquireTokenSilent({
        ...apiRequest,
        account,
      });
      return result.accessToken;
    } catch {
      return undefined;
    }
  }
}
