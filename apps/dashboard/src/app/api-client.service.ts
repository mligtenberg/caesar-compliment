import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { Compliment } from './compliment.model';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  getAll(): Promise<Compliment[]> {
    return firstValueFrom(this.http.get<Compliment[]>(`${environment.api.baseUrl}/external/compliments`));
  }
}
