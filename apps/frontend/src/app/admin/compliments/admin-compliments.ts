import { Component, inject, OnInit, signal } from '@angular/core';
import { AdminCompliment, ApiClientService } from '../../api-client.service';

@Component({
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

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.apiClient
      .getAllCompliments()
      .then((compliments) => this.compliments.set(compliments))
      .catch(() => this.error.set('Kon complimenten niet laden.'))
      .finally(() => this.loading.set(false));
  }

  protected select(compliment: AdminCompliment): void {
    this.selected.set(compliment);
  }

  protected close(): void {
    this.selected.set(null);
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

  protected async delete(compliment: AdminCompliment): Promise<void> {
    this.error.set(null);
    try {
      await this.apiClient.deleteCompliment(compliment.senderId);
      if (this.selected()?.senderId === compliment.senderId) this.close();
      this.reload();
    } catch {
      this.error.set('Kon dit compliment niet verwijderen.');
    }
  }
}
