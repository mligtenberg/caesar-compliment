import { Component, inject, signal } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { ApiKeyService } from './api-key.service';
import { Compliment } from './compliment.model';
import { ComplimentsReel } from './compliments-reel/compliments-reel';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [ComplimentsReel],
})
export class App {
  private readonly apiClient = inject(ApiClientService);
  private readonly apiKey = inject(ApiKeyService);

  protected readonly compliments = signal<Compliment[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (!this.apiKey.value) {
      this.error.set('Missing ?api_key= in the URL.');
      return;
    }

    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.compliments.set(await this.apiClient.getAll());
    } catch {
      this.error.set('Failed to load compliments. Check that the API key is valid.');
    } finally {
      this.loading.set(false);
    }
  }
}
