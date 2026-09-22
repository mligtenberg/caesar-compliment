import { Component, Input, OnChanges, signal } from '@angular/core';
import { Compliment } from '../compliment.model';
import { POSTCARD_IMAGES, cardNameFromUrl, postcardFrontIsLandscape, postcardFrontSrc } from './postcard-images';
import { renderFinishedPostcardBackLandscape } from './postcard-back-renderer';

// A calm parallax layer behind the featured card: postcards drifting down the
// screen forever. Each card is a plain CSS animation whose custom properties
// are randomized once at startup - no timers and no respawning, so the layer
// costs nothing per frame beyond compositing, however long the dashboard runs.
const CARD_COUNT = 10;
// Roughly one in six shows its back, so the layer reads as postcards rather
// than as a wall of front artwork - but stays clearly front-dominated.
const BACK_SHARE = 1 / 6;
// However few cards that share works out to, always keep at least this many
// backs in view so a finished compliment is never just a coin-flip away.
const MIN_BACKS = 2;
// The initial stagger window is split into this many bands, so cards fill
// the screen in a few visible waves rather than one continuous trickle.
const STAGGER_TIERS = 4;
const STAGGER_MAX_S = 18;

interface FallingCard {
  id: number;
  isBack: boolean;
  src: string;
  landscape: boolean;
  left: string;
  width: string;
  drift: string;
  duration: string;
  // Positive, and paired with animation-fill-mode: backwards in the CSS, so
  // each card sits off-screen above the viewport (the animation's "from"
  // position) until its turn, then falls from the top - staggered starts
  // without every card popping in mid-air or all dropping in lockstep.
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

// Assigns card i to one of STAGGER_TIERS evenly-sized bands of the stagger
// window, so entries arrive in a few distinct waves instead of one smear.
function tierRange(i: number): [min: number, max: number] {
  const tierWidth = STAGGER_MAX_S / STAGGER_TIERS;
  const tier = i % STAGGER_TIERS;
  return [tier * tierWidth, (tier + 1) * tierWidth];
}

function imageUrl(image: string | { url: string }): string {
  return typeof image === 'string' ? image : image.url;
}

// Rolls BACK_SHARE independently per card, then tops up with extra backs
// (without duplicates) until at least MIN_BACKS are showing.
function chooseBackIndices(count: number): Set<number> {
  const backs = new Set<number>();
  for (let i = 0; i < count; i++) {
    if (Math.random() < BACK_SHARE) backs.add(i);
  }
  const remaining = Array.from({ length: count }, (_, i) => i).filter((i) => !backs.has(i));
  while (backs.size < Math.min(MIN_BACKS, count) && remaining.length > 0) {
    const [i] = remaining.splice(Math.floor(Math.random() * remaining.length), 1);
    backs.add(i);
  }
  return backs;
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
    if (this.cards().length === 0) {
      // No real compliments yet to render on a back face, so the layer
      // stays front-only until the first one comes in.
      const backIndices = this.compliments.length > 0 ? chooseBackIndices(CARD_COUNT) : new Set<number>();
      this.cards.set(Array.from({ length: CARD_COUNT }, (_, i) => this.buildCard(i, backIndices.has(i))));
    }
  }

  // Fires every time a card's CSS animation loops back to its "from" state -
  // for back-facing cards, that's the moment to swap in a freshly-picked
  // compliment so the same one doesn't loop forever.
  protected onIteration(card: FallingCard): void {
    if (!card.isBack || this.compliments.length === 0) return;
    const compliment = pick(this.compliments);
    const src = renderFinishedPostcardBackLandscape(compliment.text, compliment.recipientName);
    this.cards.update((cards) => cards.map((c) => (c.id === card.id ? { ...c, src } : c)));
  }

  private buildCard(i: number, isBack: boolean): FallingCard {
    // Bigger reads as nearer: brighter, and falling faster past the viewer.
    const width = between(180, 450);
    const nearness = (width - 180) / 270;

    let src: string;
    let landscape: boolean;
    if (isBack) {
      const compliment = pick(this.compliments);
      src = renderFinishedPostcardBackLandscape(compliment.text, compliment.recipientName);
      landscape = true;
    } else {
      const cardName = cardNameFromUrl(imageUrl(pick(POSTCARD_IMAGES)));
      src = postcardFrontSrc(cardName);
      landscape = postcardFrontIsLandscape(cardName);
    }

    const duration = between(38, 46) - nearness * 20;
    const spinFrom = between(-25, 25);

    return {
      id: i,
      isBack,
      src,
      landscape,
      // Spread across the width one slot per card, jittered, so the cards
      // don't clump or line up in a visible grid.
      left: `${((i + between(0.1, 0.9)) / CARD_COUNT) * 112 - 8}%`,
      width: `${Math.round(width)}px`,
      drift: `${between(-8, 8).toFixed(1)}vw`,
      duration: `${duration.toFixed(1)}s`,
      // Stagger window split into tiers (not proportional to duration - that
      // could push a card's first appearance out past 40s), so the layer
      // fills in over a few visible waves rather than one continuous
      // trickle. The first card falls instantly so the screen never sits
      // empty for even a moment.
      delay: `${(i === 0 ? 0 : between(...tierRange(i))).toFixed(1)}s`,
      spinFrom: `${spinFrom.toFixed(1)}deg`,
      spinTo: `${(spinFrom + between(-40, 40)).toFixed(1)}deg`,
      // Low: the artwork is bright against the dark blue stage, so it carries
      // much further than the number suggests.
      opacity: (0.07 + nearness * 0.11).toFixed(2),
    };
  }
}
