import { Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, from, of, switchMap } from 'rxjs';
import { ApiClientService } from '../api-client.service';
import { Recipient } from './recipient.model';

@Component({
  selector: 'app-recipient-search',
  imports: [FormsModule],
  templateUrl: './recipient-search.html',
  styleUrl: './recipient-search.css',
})
export class RecipientSearch {
  private readonly apiClient = inject(ApiClientService);

  protected readonly searchTerm = signal('');

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

  constructor(route: ActivatedRoute, private readonly router: Router) {
    const previousName = route.snapshot.queryParamMap.get('recipientName');
    if (previousName) this.searchTerm.set(previousName);
  }

  protected selectRecipient(recipient: Recipient): void {
    this.router.navigate(['/rack'], {
      queryParams: { recipientId: recipient.id, recipientName: recipient.name },
    });
  }
}
