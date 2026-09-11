import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ApiClientService, AppState } from './api-client.service';
import { ApiKeyService } from './api-key.service';
import { Compliment } from './compliment.model';
import { ComplimentsReel } from './compliments-reel/compliments-reel';
import { preloadPostcardImages } from './compliments-reel/postcard-images';

// The dashboard is left running for the whole event, so it re-reads the app
// state periodically instead of only at startup: flipping the state in admin
// changes the reel's call-to-action without anyone touching the screen.
const APP_STATE_POLL_MS = 30000;

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [ComplimentsReel],
})
export class App implements OnDestroy {
  private readonly apiClient = inject(ApiClientService);
  private readonly apiKey = inject(ApiKeyService);

  protected readonly compliments = signal<Compliment[]>([]);
  protected readonly appState = signal<AppState | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private appStateTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (!this.apiKey.value) {
      this.error.set('Missing ?api_key= in the URL.');
      return;
    }

    this.load();
    this.pollAppState();
    this.appStateTimer = setInterval(() => this.pollAppState(), APP_STATE_POLL_MS);
  }

  ngOnDestroy(): void {
    if (this.appStateTimer) clearInterval(this.appStateTimer);
  }

  private async pollAppState(): Promise<void> {
    const state = await this.apiClient.getAppState();
    if (state) this.appState.set(state);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [compliments] = await Promise.all([this.apiClient.getAll(), preloadPostcardImages()]);
      this.compliments.set(compliments.filter((c) => !c.hideFromDashboard));
    } catch {
      this.error.set('Failed to load compliments. Check that the API key is valid.');
    } finally {
      this.loading.set(false);
    }
  }
}
