export type PostcardOrientation = 'portrait' | 'landscape';

export interface PostcardImage {
  url: string;
  orientation?: PostcardOrientation;
}

// Generated card front artwork (SVG designs rendered to PNG), see
// apps/frontend/public/assets/cards. Edit this list to change which
// cards appear on the rack. A plain string defaults to portrait orientation.
export const POSTCARD_IMAGES: (string | PostcardImage)[] = Array.from(
  { length: 17 },
  (_, i) => `/assets/cards/designs/${String(i + 1)}.png`,
);

// Mirrors rack.js's cardNameFromUrl(): a card's "name" is its design filename
// without extension, the only stable identifier stored per sent compliment.
export function postcardFrontSrc(cardName: string): string {
  return `/assets/cards/designs/${cardName}.png`;
}

export function postcardIsLandscape(cardName: string): boolean {
  const entry = POSTCARD_IMAGES.find((image) => {
    const url = typeof image === 'string' ? image : image.url;
    return url.endsWith(`/${cardName}.png`);
  });
  if (!entry || typeof entry === 'string') return false;
  return entry.orientation === 'landscape';
}
