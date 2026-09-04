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
  hideFromDashboard: boolean;
}

export interface RoleAssignment {
  objectId: string;
  role: string;
  displayName: string;
}

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string | null;
}

export type AppState = 'Open' | 'Locked' | 'Receive';

export interface ReceivedCompliment {
  senderName: string;
  recipientName: string;
  cardName: string;
  text: string;
}

export interface AdminCompliment {
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  text: string;
  hideFromDashboard: boolean;
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

  getMyRole(): Promise<string> {
    return firstValueFrom(
      this.http.get<string>(`${environment.api.baseUrl}/myrole`).pipe(
        catchError(() => of('user'))
      )
    );
  }

  getRoleAssignments(): Promise<RoleAssignment[]> {
    return firstValueFrom(this.http.get<RoleAssignment[]>(`${environment.api.baseUrl}/roles`));
  }

  searchUsers(query: string): Promise<GraphUser[]> {
    const trimmed = query.trim();
    if (!trimmed) return Promise.resolve([]);

    const url = `${environment.api.baseUrl}/roles/search?query=${encodeURIComponent(trimmed)}`;
    return firstValueFrom(this.http.get<GraphUser[]>(url), { defaultValue: [] });
  }

  assignRole(objectId: string, role: string, displayName: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${environment.api.baseUrl}/roles`, { objectId, role, displayName })
    );
  }

  removeRole(objectId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${environment.api.baseUrl}/roles/${encodeURIComponent(objectId)}`)
    );
  }

  getAllCompliments(): Promise<AdminCompliment[]> {
    return firstValueFrom(
      this.http.get<AdminCompliment[]>(`${environment.api.baseUrl}/admin/compliments`)
    );
  }

  hideCompliment(senderId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${environment.api.baseUrl}/admin/compliments/${encodeURIComponent(senderId)}/hide`,
        {}
      )
    );
  }

  deleteCompliment(senderId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `${environment.api.baseUrl}/admin/compliments/${encodeURIComponent(senderId)}`
      )
    );
  }

  searchAdminSendRecipients(term: string): Promise<Recipient[]> {
    const trimmed = term.trim();
    const url = `${environment.api.baseUrl}/admin/send/recipients?term=${encodeURIComponent(trimmed)}`;
    return firstValueFrom(this.http.get<Recipient[]>(url), { defaultValue: [] });
  }

  async sendAdminCompliment(compliment: ComplimentRequest): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.api.baseUrl}/admin/send`, compliment));
  }

  getAppState(): Promise<AppState> {
    return firstValueFrom(
      this.http.get<AppState>(`${environment.api.baseUrl}/appstate`).pipe(catchError(() => of('Open' as AppState)))
    );
  }

  setAppState(state: AppState): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${environment.api.baseUrl}/admin/appstate`, { state })
    );
  }

  getReceivedCompliments(): Promise<ReceivedCompliment[]> {
    return firstValueFrom(
      this.http.get<ReceivedCompliment[]>(`${environment.api.baseUrl}/compliments/received`).pipe(
        catchError(() => of<ReceivedCompliment[]>([]))
      )
    );
  }
}
