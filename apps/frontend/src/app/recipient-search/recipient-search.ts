import { Component, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, from, of, switchMap } from 'rxjs';
import { ApiClientService } from '../api-client.service';
import { AvatarService } from './avatar.service';
import { Recipient } from './recipient.model';

@Component({
  selector: 'app-recipient-search',
  imports: [FormsModule],
  templateUrl: './recipient-search.html',
  styleUrl: './recipient-search.css',
})
export class RecipientSearch {
  private readonly apiClient = inject(ApiClientService);
  private readonly avatarService = inject(AvatarService);
  private readonly router = inject(Router);

  protected readonly searchTerm = signal('');
  protected readonly avatarUrls = signal<Record<string, string | null>>({});

  protected readonly suggestions = toSignal(
    toObservable(this.searchTerm).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((term) =>
        from(this.apiClient.searchRecipients(term)).pipe(
          catchError(() => of<Recipient[]>([]))
        )
      )
    ),
    { initialValue: [] as Recipient[] }
  );

  constructor() {
    const route = inject(ActivatedRoute);
    const previousName = route.snapshot.queryParamMap.get('recipientName');
    if (previousName) this.searchTerm.set(previousName);

    effect(() => {
      for (const recipient of this.suggestions()) {
        if (!recipient.avatarUrl || recipient.id in this.avatarUrls()) continue;

        this.avatarService.get(recipient.avatarUrl).then((url) => {
          this.avatarUrls.update((urls) => ({ ...urls, [recipient.id]: url }));
        });
      }
    });
  }

  protected selectRecipient(recipient: Recipient): void {
    this.router.navigate(['/rack'], {
      queryParams: { recipientId: recipient.id, recipientName: recipient.name },
    });
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
