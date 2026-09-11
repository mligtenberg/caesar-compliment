import { Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, from, of, switchMap } from 'rxjs';
import { ApiClientService } from '../../api-client.service';
import { Recipient } from '../../recipient-search/recipient.model';
import { POSTCARD_IMAGES, postcardFrontSrc } from '../../postcard-rack/postcard-images';

interface PostcardChoice {
  cardName: string;
  imageUrl: string;
}

function cardNameFromUrl(url: string): string {
  const fileName = url.split('/').pop() ?? url;
  return fileName.replace(/\.[^.]+$/, '');
}

const POSTCARD_CHOICES: PostcardChoice[] = POSTCARD_IMAGES.map((image) => {
  const url = typeof image === 'string' ? image : image.url;
  const cardName = cardNameFromUrl(url);
  return { cardName, imageUrl: postcardFrontSrc(cardName) };
});

@Component({
  imports: [FormsModule],
  selector: 'app-admin-send-form',
  templateUrl: './admin-send-form.html',
  styleUrl: './admin-send-form.css',
})
export class AdminSendForm {
  private readonly apiClient = inject(ApiClientService);

  protected readonly cards = POSTCARD_CHOICES;
  protected readonly cardIndex = signal(0);

  protected readonly query = signal('');
  protected readonly selected = signal<Recipient | null>(null);
  protected text = '';
  protected hideFromDashboard = false;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  readonly sent = output<void>();

  private readonly suggestionsList = viewChild<ElementRef<HTMLElement>>('suggestionsList');

  protected readonly suggestions = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((query) =>
        this.selected()?.name === query
          ? of<Recipient[]>([])
          : from(this.apiClient.searchAdminSendRecipients(query)).pipe(
              catchError(() => of<Recipient[]>([]))
            )
      )
    ),
    { initialValue: [] as Recipient[] }
  );

  constructor() {
    // The suggestions list is a manual popover (top-layer, anchor-positioned to the
    // input) so it renders outside the modal's DOM subtree and can't be visually
    // clipped by the modal's own overflow/scroll container.
    effect(() => {
      const el = this.suggestionsList()?.nativeElement;
      if (!el) return;

      const hasSuggestions = this.suggestions().length > 0;
      if (hasSuggestions && !el.matches(':popover-open')) {
        el.showPopover();
      } else if (!hasSuggestions && el.matches(':popover-open')) {
        el.hidePopover();
      }
    });
  }

  protected get selectedCard(): PostcardChoice {
    return this.cards[this.cardIndex()];
  }

  protected previousCard(): void {
    this.cardIndex.update((index) => (index - 1 + this.cards.length) % this.cards.length);
  }

  protected nextCard(): void {
    this.cardIndex.update((index) => (index + 1) % this.cards.length);
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    if (this.selected()) this.selected.set(null);
  }

  protected selectRecipient(recipient: Recipient): void {
    this.selected.set(recipient);
    this.query.set(recipient.name);
  }

  protected async send(): Promise<void> {
    const recipient = this.selected();
    if (!recipient || !this.text.trim()) return;

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      await this.apiClient.sendAdminCompliment({
        recipientId: recipient.id,
        recipientName: recipient.name,
        cardName: this.selectedCard.cardName,
        text: this.text.trim(),
        hideFromDashboard: this.hideFromDashboard,
      });
      this.success.set(`Compliment verstuurd naar ${recipient.name}.`);
      this.query.set('');
      this.selected.set(null);
      this.text = '';
      this.hideFromDashboard = false;
      this.cardIndex.set(0);
      this.sent.emit();
    } catch {
      this.error.set('Kon dit compliment niet versturen.');
    } finally {
      this.saving.set(false);
    }
  }
}
