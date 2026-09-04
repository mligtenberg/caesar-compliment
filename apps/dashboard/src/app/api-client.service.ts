import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from '../environments/environment';
import { Compliment } from './compliment.model';

export type AppState = 'Open' | 'Locked' | 'Receive';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  getAll(): Promise<Compliment[]> {
    return firstValueFrom(this.http.get<Compliment[]>(`${environment.api.baseUrl}/external/compliments`));
  }

  // A hiccup here must not take the reel down with it - the dashboard runs
  // unattended on a big screen - so a failed poll keeps the last known state.
  getAppState(): Promise<AppState | null> {
    return firstValueFrom(
      this.http
        .get<AppState>(`${environment.api.baseUrl}/external/appstate`)
        .pipe(catchError(() => of(null)))
    );
  }
}
