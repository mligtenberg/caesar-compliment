import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { loginRequest } from './auth-config';
import { ApiClientService } from './api-client.service';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected title = 'frontend';
  private readonly msalService = inject(MsalService);
  private readonly apiClient = inject(ApiClientService);

  protected displayName?: string;
  protected profilePictureUrl?: string;
  protected readonly isAdmin = signal(false);

  ngOnInit(): void {
    if (!this.msalService.instance.getActiveAccount()) {
      const [firstAccount] = this.msalService.instance.getAllAccounts();
      if (firstAccount) {
        this.msalService.instance.setActiveAccount(firstAccount);
      }
    }
    const account = this.msalService.instance.getActiveAccount();
    if (account) {
      this.displayName = account.name;
      this.loadProfile();
      this.loadRole();
    }
  }

  private loadRole(): void {
    this.apiClient.getMyRole().then((role) => {
      this.isAdmin.set(role === 'admin');
    });
  }

  protected get initials(): string {
    const name = this.displayName ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected signOut(): void {
    this.msalService.logoutRedirect();
  }

  private loadProfile(): void {
    const account = this.msalService.instance.getActiveAccount();
    if (!account) return;

    this.msalService.instance
      .acquireTokenSilent({ ...loginRequest, account })
      .then((result) => {
        const authHeader = { Authorization: `Bearer ${result.accessToken}` };

        fetch('https://graph.microsoft.com/v1.0/me?$select=displayName', {
          headers: authHeader,
        })
          .then((response) => (response.ok ? response.json() : Promise.reject()))
          .then((profile) => {
            if (profile.displayName) {
              this.displayName = profile.displayName;
            }
          })
          .catch(() => undefined);

        fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: authHeader,
        })
          .then((response) => (response.ok ? response.blob() : Promise.reject()))
          .then((blob) => {
            this.profilePictureUrl = URL.createObjectURL(blob);
          })
          .catch(() => {
            this.profilePictureUrl = undefined;
          });
      })
      .catch(() => undefined);
  }
}
