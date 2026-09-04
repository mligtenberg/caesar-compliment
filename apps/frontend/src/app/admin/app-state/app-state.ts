import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiClientService, AppState, NotifyResult } from '../../api-client.service';

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

  protected readonly mailing = signal(false);
  protected readonly mailResult = signal<NotifyResult | null>(null);
  protected readonly mailError = signal<string | null>(null);

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
    this.mailResult.set(null);
    this.mailError.set(null);
    try {
      await this.apiClient.setAppState(state);
      this.current.set(state);
    } catch {
      this.error.set('Kon de status niet opslaan.');
    } finally {
      this.saving.set(false);
    }
  }

  // Mailing everyone at once can't be taken back, so it asks first - and it only
  // exists while the app is in Receive, which is when the mail's message is true.
  protected async sendMails(): Promise<void> {
    if (!confirm('Iedereen die een complimentje heeft gekregen een mail sturen?')) return;

    this.mailing.set(true);
    this.mailError.set(null);
    this.mailResult.set(null);
    try {
      this.mailResult.set(await this.apiClient.notifyRecipients());
    } catch {
      this.mailError.set('Kon de mails niet versturen.');
    } finally {
      this.mailing.set(false);
    }
  }
}
