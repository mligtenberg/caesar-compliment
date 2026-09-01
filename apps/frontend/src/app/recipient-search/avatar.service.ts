import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Promise<string | null>>();

  get(avatarPath: string): Promise<string | null> {
    let pending = this.cache.get(avatarPath);
    if (!pending) {
      pending = this.fetch(avatarPath);
      this.cache.set(avatarPath, pending);
    }
    return pending;
  }

  private async fetch(avatarPath: string): Promise<string | null> {
    try {
      const blob = await firstValueFrom(
        this.http.get(`${environment.api.baseUrl}${avatarPath}`, { responseType: 'blob' })
      );
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
}
