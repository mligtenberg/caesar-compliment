export type PostcardOrientation = 'portrait' | 'landscape';

export interface PostcardImage {
  url: string;
  orientation?: PostcardOrientation;
}

// Mirrors apps/frontend/src/app/postcard-rack/postcard-images.ts - the
// dashboard has no dependency on the frontend app, so the front artwork
// list (and which entries are landscape) is duplicated here.
export const POSTCARD_IMAGES: (string | PostcardImage)[] = Array.from(
  { length: 7 },
  (_, i) => `/assets/cards/designs/${String(i + 1)}.svg`,
);

export function postcardFrontIsLandscape(cardName: string): boolean {
  const entry = POSTCARD_IMAGES.find((image) => {
    const url = typeof image === 'string' ? image : image.url;
    return url.endsWith(`/${cardName}.svg`);
  });
  if (!entry || typeof entry === 'string') return false;
  return entry.orientation === 'landscape';
}

// Warms the browser's HTTP cache for every card front so the reel's flying
// cards never stall on a network fetch mid-animation.
export function precachePostcardImages(): void {
  for (const image of POSTCARD_IMAGES) {
    new Image().src = typeof image === 'string' ? image : image.url;
  }
}
