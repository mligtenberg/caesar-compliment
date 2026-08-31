import { Component, Input, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';
import { Compliment } from '../compliment.model';
import { postcardFrontIsLandscape } from './postcard-images';
import { renderFinishedPostcardBack } from './postcard-back-renderer';
import { FallingCards } from './falling-cards';

const CARD_DURATION_MS = 5000;
const CYCLE_DURATION_MS = 60000;
const CARDS_PER_CYCLE = Math.ceil(CYCLE_DURATION_MS / CARD_DURATION_MS);

interface ReelCard {
  // Unique per showing (not per compliment) so *ngFor/@for's track forces the
  // element to be recreated each time - a CSS animation only replays on a
  // fresh element, not when an existing one's bindings merely change.
  id: number;
  frontSrc: string;
  frontIsLandscape: boolean;
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

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Builds a randomized queue of at least `size` compliments, reshuffling and
// concatenating fresh passes over the source list so a short list still
// produces a varied - not just repeating - 60 second cycle.
function buildQueue(compliments: readonly Compliment[], size: number): Compliment[] {
  const queue: Compliment[] = [];
  while (queue.length < size) {
    queue.push(...shuffled(compliments));
  }
  return queue.slice(0, size);
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

  protected readonly cards = signal<ReelCard[]>([]);

  private queue: Compliment[] = [];
  private queueIndex = 0;
  private nextId = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['compliments'] && this.compliments.length > 0 && !this.timer) {
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

    const compliment = this.queue[this.queueIndex++];
    this.cards.set([{
      id: this.nextId++,
      frontSrc: `/assets/cards/designs/${compliment.cardName}.png`,
      frontIsLandscape: postcardFrontIsLandscape(compliment.cardName),
      backSrc: renderFinishedPostcardBack(compliment.text, compliment.recipientName),
      recipientName: compliment.recipientName,
      text: compliment.text,
      ...randomFlight(),
    }]);
  }

  private refillQueue(): void {
    this.queue = buildQueue(this.compliments, CARDS_PER_CYCLE);
    this.queueIndex = 0;
  }
}
