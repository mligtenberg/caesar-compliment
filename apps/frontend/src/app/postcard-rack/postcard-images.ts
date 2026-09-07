export type PostcardOrientation = 'portrait' | 'landscape';

export interface PostcardImage {
  url: string;
  orientation?: PostcardOrientation;
}

// Card front artwork, see libs/shared-assets/cards/designs (shared with the
// dashboard, see apps/dashboard/src/app/compliments-reel/postcard-images.ts).
// Edit this list to change which cards appear on the rack. A plain string
// defaults to portrait orientation.
export const POSTCARD_IMAGES: (string | PostcardImage)[] = Array.from(
  { length: 7 },
  (_, i) => `/assets/cards/designs/${String(i + 1)}.svg`,
);

// Mirrors rack.js's cardNameFromUrl(): a card's "name" is its design filename
// without extension, the only stable identifier stored per sent compliment.
export function postcardFrontSrc(cardName: string): string {
  return `/assets/cards/designs/${cardName}.svg`;
}

export function postcardIsLandscape(cardName: string): boolean {
  const entry = POSTCARD_IMAGES.find((image) => {
    const url = typeof image === 'string' ? image : image.url;
    return url.endsWith(`/${cardName}.svg`);
  });
  if (!entry || typeof entry === 'string') return false;
  return entry.orientation === 'landscape';
}

// Warms the browser's HTTP cache for every card front so picking a card (or
// showing one back on receive) doesn't stall on a network fetch.
export function precachePostcardImages(): void {
  for (const image of POSTCARD_IMAGES) {
    new Image().src = typeof image === 'string' ? image : image.url;
  }
}
