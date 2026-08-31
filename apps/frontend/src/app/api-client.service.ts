import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from '../environments/environment';
import { Recipient } from './recipient-search/recipient.model';

export interface ComplimentRequest {
  recipientId: string;
  recipientName: string;
  cardName: string;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  searchRecipients(term: string): Promise<Recipient[]> {
    const trimmed = term.trim();
    const url = `${environment.api.baseUrl}/suggestions?term=${encodeURIComponent(trimmed)}`;
    return firstValueFrom(this.http.get<Recipient[]>(url), { defaultValue: [] });
  }

  async send(compliment: ComplimentRequest): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.api.baseUrl}/compliments`, compliment));
  }

  getMine(): Promise<ComplimentRequest | null> {
    return firstValueFrom(
      this.http.get<ComplimentRequest>(`${environment.api.baseUrl}/compliments/mine`).pipe(
        catchError(() => of(null))
      )
    );
  }
}
