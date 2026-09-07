import { Component, Input, OnChanges, signal } from '@angular/core';
import { Compliment } from '../compliment.model';
import { POSTCARD_IMAGES, postcardFrontIsLandscape } from './postcard-images';
import { renderFinishedPostcardBackLandscape } from './postcard-back-renderer';

// A calm parallax layer behind the featured card: postcards drifting down the
// screen forever. Each card is a plain CSS animation whose custom properties
// are randomized once at startup - no timers and no respawning, so the layer
// costs nothing per frame beyond compositing, however long the dashboard runs.
const CARD_COUNT = 18;
// Roughly one in six shows its back, so the layer reads as postcards rather
// than as a wall of front artwork - but stays clearly front-dominated.
const BACK_SHARE = 1 / 6;

interface FallingCard {
  id: number;
  src: string;
  landscape: boolean;
  left: string;
  width: string;
  drift: string;
  duration: string;
  // Negative, so every card is already mid-fall on the first frame instead of
  // the screen starting empty and filling up over the first cycle.
  delay: string;
  spinFrom: string;
  spinTo: string;
  opacity: string;
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function imageUrl(image: string | { url: string }): string {
  return typeof image === 'string' ? image : image.url;
}

function cardNameFromUrl(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1).replace('.svg', '');
}

@Component({
  selector: 'app-falling-cards',
  templateUrl: './falling-cards.html',
  styleUrl: './falling-cards.css',
})
export class FallingCards implements OnChanges {
  @Input() compliments: Compliment[] = [];

  protected readonly cards = signal<FallingCard[]>([]);

  ngOnChanges(): void {
    if (this.compliments.length > 0 && this.cards().length === 0) {
      this.cards.set(Array.from({ length: CARD_COUNT }, (_, i) => this.buildCard(i)));
    }
  }

  private buildCard(i: number): FallingCard {
    // Bigger reads as nearer: brighter, and falling faster past the viewer.
    // Kept well under the featured card's ~320px so the layer stays scenery.
    const width = between(46, 120);
    const nearness = (width - 46) / 74;
    const isBack = Math.random() < BACK_SHARE;

    let src: string;
    let landscape: boolean;
    if (isBack) {
      const compliment = pick(this.compliments);
      src = renderFinishedPostcardBackLandscape(compliment.text, compliment.recipientName);
      landscape = true;
    } else {
      const url = imageUrl(pick(POSTCARD_IMAGES));
      src = url;
      landscape = postcardFrontIsLandscape(cardNameFromUrl(url));
    }

    const duration = between(38, 46) - nearness * 20;
    const spinFrom = between(-25, 25);

    return {
      id: i,
      src,
      landscape,
      // Spread across the width one slot per card, jittered, so the cards
      // don't clump or line up in a visible grid.
      left: `${((i + between(0.1, 0.9)) / CARD_COUNT) * 112 - 8}%`,
      width: `${Math.round(width)}px`,
      drift: `${between(-8, 8).toFixed(1)}vw`,
      duration: `${duration.toFixed(1)}s`,
      delay: `${(-Math.random() * duration).toFixed(1)}s`,
      spinFrom: `${spinFrom.toFixed(1)}deg`,
      spinTo: `${(spinFrom + between(-40, 40)).toFixed(1)}deg`,
      // Low: the artwork is bright against the dark blue stage, so it carries
      // much further than the number suggests.
      opacity: (0.07 + nearness * 0.11).toFixed(2),
    };
  }
}
