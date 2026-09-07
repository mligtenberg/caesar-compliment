export type PostcardOrientation = 'portrait' | 'landscape';

export interface PostcardImage {
  url: string;
  orientation?: PostcardOrientation;
}

// Mirrors apps/frontend/src/app/postcard-rack/postcard-images.ts - the
// dashboard has no dependency on the frontend app, so this list (and which
// entries are landscape) is duplicated here. The artwork files themselves
// are shared, not duplicated: both apps' build copies them in from
// libs/shared-assets/cards/designs (see each app's project.json).
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
// cards never stall on a network fetch mid-animation. Resolves once every
// image has loaded (or failed) so callers can wait out the warm-up.
export function precachePostcardImages(): Promise<void> {
  const loads = POSTCARD_IMAGES.map((image) => {
    const url = typeof image === 'string' ? image : image.url;
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  });
  return Promise.all(loads).then(() => undefined);
}
