import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiClientService, AppState } from '../../api-client.service';

@Component({
  selector: 'app-admin-app-state',
  templateUrl: './app-state.html',
  styleUrl: './app-state.css',
})
export class AppStatePage implements OnInit {
  private readonly apiClient = inject(ApiClientService);

  protected readonly states: { value: AppState; label: string; description: string }[] = [
    { value: 'Open', label: 'Open', description: 'Iedereen kan een complimentje versturen.' },
    { value: 'Locked', label: 'Gesloten', description: 'De actie is tijdelijk gesloten, niemand kan iets versturen of ontvangen.' },
    { value: 'Receive', label: 'Ontvangen', description: 'Versturen is gesloten, de complimentjes worden nu bezorgd.' },
  ];

  protected readonly current = signal<AppState | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.apiClient
      .getAppState()
      .then((state) => this.current.set(state))
      .catch(() => this.error.set('Kon de status niet laden.'))
      .finally(() => this.loading.set(false));
  }

  protected async setState(state: AppState): Promise<void> {
    if (state === this.current()) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.apiClient.setAppState(state);
      this.current.set(state);
    } catch {
      this.error.set('Kon de status niet opslaan.');
    } finally {
      this.saving.set(false);
    }
  }
}
