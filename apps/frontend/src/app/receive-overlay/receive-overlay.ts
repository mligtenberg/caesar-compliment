import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ApiClientService, ReceivedCompliment } from '../api-client.service';
import { postcardFrontSrc, postcardIsLandscape } from '../postcard-rack/postcard-images';
import { renderFinishedPostcardBack } from '../postcard-rack/postcard-back-renderer';

// How long a card holds centered before the next one flies in, when someone
// received more than one compliment. Unlike the dashboard reel, cards here
// never fly back out - the next one simply replaces the current one.
const HOLD_MS = 6000;

interface ReceiveCard {
  // Unique per showing, not per compliment - forces the element to be
  // recreated so the CSS entry animation replays (see compliments-reel).
  id: number;
  frontSrc: string;
  frontIsLandscape: boolean;
  backSrc: string;
  inX: number;
  inY: number;
  inRot: number;
}

// Same tumble-in as the dashboard reel's randomFlight(), minus the exit leg -
// this card never flies back out.
function randomEntry(): Pick<ReceiveCard, 'inX' | 'inY' | 'inRot'> {
  const angle = Math.random() * Math.PI * 2;
  const distance = 900;

  return {
    inX: Math.round(Math.cos(angle) * distance),
    inY: Math.round(Math.sin(angle) * distance),
    inRot: Math.round((Math.random() - 0.5) * 720),
  };
}

@Component({
  selector: 'app-receive-overlay',
  templateUrl: './receive-overlay.html',
  styleUrl: './receive-overlay.css',
})
export class ReceiveOverlay implements OnInit, OnDestroy {
  private readonly apiClient = inject(ApiClientService);

  // A single-element array, not a plain object - @for's track forces the DOM
  // node to be recreated on each swap, which is required for the CSS entry
  // animation to replay (see compliments-reel).
  protected readonly cards = signal<ReceiveCard[]>([]);
  protected readonly loading = signal(true);
  protected readonly empty = signal(false);

  private compliments: ReceivedCompliment[] = [];
  private index = 0;
  private nextId = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.apiClient
      .getReceivedCompliments()
      .then((compliments) => {
        this.compliments = compliments;
        this.empty.set(compliments.length === 0);
        if (compliments.length === 0) return;

        this.showCurrent();
        if (compliments.length > 1) {
          this.timer = setInterval(() => this.showNext(), HOLD_MS);
        }
      })
      .finally(() => this.loading.set(false));
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private showNext(): void {
    this.index = (this.index + 1) % this.compliments.length;
    this.showCurrent();
  }

  private showCurrent(): void {
    const compliment = this.compliments[this.index];
    this.cards.set([{
      id: this.nextId++,
      frontSrc: postcardFrontSrc(compliment.cardName),
      frontIsLandscape: postcardIsLandscape(compliment.cardName),
      backSrc: renderFinishedPostcardBack(compliment.text, compliment.recipientName),
      ...randomEntry(),
    }]);
  }
}
