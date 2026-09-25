import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AdminCompliment, ApiClientService } from '../../api-client.service';
import { AdminSendForm } from '../send/admin-send-form';

@Component({
  imports: [AdminSendForm],
  selector: 'app-admin-compliments',
  templateUrl: './admin-compliments.html',
  styleUrl: './admin-compliments.css',
})
export class AdminCompliments implements OnInit {
  private readonly apiClient = inject(ApiClientService);

  protected readonly compliments = signal<AdminCompliment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = signal<AdminCompliment | null>(null);
  protected readonly search = signal('');
  protected readonly adding = signal(false);
  protected readonly pendingDelete = signal<AdminCompliment | null>(null);
  protected readonly canMail = signal(false);
  protected readonly mailing = signal<string | null>(null);
  protected readonly totalRecipients = signal<number | null>(null);

  protected readonly filteredCompliments = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.compliments();
    return this.compliments().filter(
      (compliment) =>
        compliment.recipientName.toLowerCase().includes(query) ||
        compliment.senderName.toLowerCase().includes(query) ||
        compliment.text.toLowerCase().includes(query),
    );
  });

  ngOnInit(): void {
    this.reload();
    this.apiClient.getAppState().then((state) => this.canMail.set(state === 'Receive'));
    this.apiClient.getRecipientsCount().then((count) => this.totalRecipients.set(count));
  }

  private reload(): void {
    this.loading.set(true);
    this.apiClient
      .getAllCompliments()
      .then((compliments) => {
        this.compliments.set(compliments);
        const selected = this.selected();
        if (selected) {
          this.selected.set(compliments.find((c) => c.senderId === selected.senderId) ?? null);
        }
      })
      .catch(() => this.error.set('Kon complimenten niet laden.'))
      .finally(() => this.loading.set(false));
  }

  protected select(compliment: AdminCompliment): void {
    this.selected.set(compliment);
  }

  protected close(): void {
    this.selected.set(null);
  }

  protected openAdd(): void {
    this.adding.set(true);
  }

  protected closeAdd(): void {
    this.adding.set(false);
  }

  protected onAdded(): void {
    this.adding.set(false);
    this.reload();
  }

  protected async hide(compliment: AdminCompliment): Promise<void> {
    this.error.set(null);
    try {
      await this.apiClient.hideCompliment(compliment.senderId);
      this.reload();
    } catch {
      this.error.set('Kon dit compliment niet verbergen.');
    }
  }

  protected async mail(compliment: AdminCompliment): Promise<void> {
    this.error.set(null);
    this.mailing.set(compliment.senderId);
    try {
      await this.apiClient.mailCompliment(compliment.senderId);
      this.reload();
    } catch {
      this.error.set('Kon dit compliment niet mailen.');
    } finally {
      this.mailing.set(null);
    }
  }

  protected requestDelete(compliment: AdminCompliment): void {
    this.pendingDelete.set(compliment);
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const compliment = this.pendingDelete();
    if (!compliment) return;
    this.error.set(null);
    try {
      await this.apiClient.deleteCompliment(compliment.senderId);
      if (this.selected()?.senderId === compliment.senderId) this.close();
      this.pendingDelete.set(null);
      this.reload();
    } catch {
      this.error.set('Kon dit compliment niet verwijderen.');
      this.pendingDelete.set(null);
    }
  }
}
