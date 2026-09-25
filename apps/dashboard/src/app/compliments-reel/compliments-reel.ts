import { Component, Input, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';
import { AppState } from '../api-client.service';
import { Compliment } from '../compliment.model';
import { POSTCARD_IMAGES, cardNameFromUrl, postcardFrontIsLandscape, postcardFrontSrc } from './postcard-images';
import { renderFinishedPostcardBack } from './postcard-back-renderer';
import { FallingCards } from './falling-cards';

// Must match the total animation duration in compliments-reel.css (reel-card /
// reel-card-flip): fly-in (1800ms) + flip (400ms) + hold on the back (10000ms,
// so it's readable for at least 10s) + fly-out (2300ms).
const CARD_DURATION_MS = 14500;
// The reel should never look sparse: even a handful of real compliments
// still cycles through at least this many cards per pass (see buildQueue).
// Above that, every real compliment gets a slot - the cycle just runs longer.
const MIN_CARDS_PER_CYCLE = 2;

interface ReelCard {
  // Unique per showing (not per compliment) so *ngFor/@for's track forces the
  // element to be recreated each time - a CSS animation only replays on a
  // fresh element, not when an existing one's bindings merely change.
  id: number;
  frontSrc: string;
  frontIsLandscape: boolean;
  // Filler cards (see buildQueue) have no message to reveal, so they fly
  // through front-only and never flip.
  isFiller: boolean;
  backSrc: string;
  recipientName: string;
  text: string;
  inX: number;
  inY: number;
  inRot: number;
  outX: number;
  outY: number;
  outRot: number;
}

function imageUrl(image: string | { url: string }): string {
  return typeof image === 'string' ? image : image.url;
}

function randomCardName(): string {
  const image = POSTCARD_IMAGES[Math.floor(Math.random() * POSTCARD_IMAGES.length)];
  return cardNameFromUrl(imageUrl(image));
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Builds a randomized queue of exactly `size` slots. A real compliment fills
// each slot while there are enough to go around; once they run out (down to
// none at all) the rest of the queue is padded with `null` (filler) slots -
// then the whole queue is reshuffled so filler doesn't always trail the real
// compliments.
function buildQueue(compliments: readonly Compliment[], size: number): (Compliment | null)[] {
  if (compliments.length >= size) return shuffled(compliments).slice(0, size);

  const fillerCount = size - compliments.length;
  return shuffled([...compliments, ...Array.from({ length: fillerCount }, () => null)]);
}

// Random offscreen entry point and rotation, mirroring how a postcard would
// tumble in from any direction; the exit reuses the opposite side so the
// card reads as continuing its flight rather than snapping back.
function randomFlight(): Pick<ReelCard, 'inX' | 'inY' | 'inRot' | 'outX' | 'outY' | 'outRot'> {
  const angle = Math.random() * Math.PI * 2;
  const distance = 900;
  const inX = Math.round(Math.cos(angle) * distance);
  const inY = Math.round(Math.sin(angle) * distance);
  const inRot = Math.round((Math.random() - 0.5) * 720);

  return {
    inX,
    inY,
    inRot,
    outX: -Math.round(Math.cos(angle) * distance),
    outY: -Math.round(Math.sin(angle) * distance),
    outRot: inRot + Math.round((Math.random() - 0.5) * 360),
  };
}

@Component({
  selector: 'app-compliments-reel',
  templateUrl: './compliments-reel.html',
  styleUrl: './compliments-reel.css',
  imports: [FallingCards],
})
export class ComplimentsReel implements OnChanges, OnDestroy {
  @Input() compliments: Compliment[] = [];
  @Input() appState: AppState | null = null;

  protected readonly cards = signal<ReelCard[]>([]);

  // The QR points at the send flow while it's open and at the receive flow once
  // the compliments are being delivered; while everything is locked there is
  // nothing to invite anyone to, so the card stays hidden.
  protected get qrText(): string | null {
    switch (this.appState) {
      case 'Open':
        return 'Ook een complimentje sturen?';
      case 'Receive':
        return 'Jouw complimentje zien?';
      default:
        return null;
    }
  }

  private queue: (Compliment | null)[] = [];
  private queueIndex = 0;
  private nextId = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['compliments'] && !this.timer) {
      this.start();
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private start(): void {
    this.refillQueue();
    this.showNext();
    this.timer = setInterval(() => this.showNext(), CARD_DURATION_MS);
  }

  private showNext(): void {
    if (this.queueIndex >= this.queue.length) {
      this.refillQueue();
    }

    const item = this.queue[this.queueIndex++];
    this.cards.set([item ? this.buildComplimentCard(item) : this.buildFillerCard()]);
  }

  private buildComplimentCard(compliment: Compliment): ReelCard {
    return {
      id: this.nextId++,
      frontSrc: postcardFrontSrc(compliment.cardName),
      frontIsLandscape: postcardFrontIsLandscape(compliment.cardName),
      isFiller: false,
      backSrc: renderFinishedPostcardBack(compliment.text, compliment.recipientName),
      recipientName: compliment.recipientName,
      text: compliment.text,
      ...randomFlight(),
    };
  }

  private buildFillerCard(): ReelCard {
    const cardName = randomCardName();
    return {
      id: this.nextId++,
      frontSrc: postcardFrontSrc(cardName),
      frontIsLandscape: postcardFrontIsLandscape(cardName),
      isFiller: true,
      backSrc: '',
      recipientName: '',
      text: '',
      ...randomFlight(),
    };
  }

  private refillQueue(): void {
    const size = Math.max(this.compliments.length, MIN_CARDS_PER_CYCLE);
    this.queue = buildQueue(this.compliments, size);
    this.queueIndex = 0;
  }
}
