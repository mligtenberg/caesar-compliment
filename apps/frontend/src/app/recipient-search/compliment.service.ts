import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { apiRequest } from '../auth-config';
import { environment } from '../../environments/environment';

export interface ComplimentRequest {
  recipientId: string;
  recipientName: string;
  cardName: string;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ComplimentService {
  private readonly msalService = inject(MsalService);

  async send(compliment: ComplimentRequest): Promise<void> {
    const accessToken = await this.acquireAccessToken();
    if (!accessToken) return;

    await fetch(`${environment.api.baseUrl}/compliments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(compliment),
    });
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
