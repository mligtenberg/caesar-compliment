export type PostcardOrientation = 'portrait' | 'landscape';

export interface PostcardImage {
  url: string;
  orientation?: PostcardOrientation;
}

// Mirrors apps/frontend/src/app/postcard-rack/postcard-images.ts - the
// dashboard has no dependency on the frontend app, so this list (and which
// entries are landscape) is duplicated here. The artwork files themselves
// are shared, not duplicated: both apps' build copies them in from
// libs/shared-assets/cards/designs (see each app's project.json). Filenames
// here are only ever used as identifiers (see cardNameFromUrl) — the actual
// asset loaded is always the design's .png, see postcardFrontSrc.
export const POSTCARD_IMAGES: (string | PostcardImage)[] = Array.from(
  { length: 7 },
  (_, i) => `/assets/cards/designs/${String(i + 1)}.svg`,
);

export function cardNameFromUrl(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
}

export function postcardFrontIsLandscape(cardName: string): boolean {
  const entry = POSTCARD_IMAGES.find((image) => {
    const url = typeof image === 'string' ? image : image.url;
    return url.endsWith(`/${cardName}.svg`);
  });
  if (!entry || typeof entry === 'string') return false;
  return entry.orientation === 'landscape';
}

// One in-memory blob: URL per design, filled in by preloadPostcardImages() as
// each PNG finishes downloading — every other place a card front is shown
// (the featured card, the falling-cards backdrop) reuses these instead of
// hitting the network (or rasterizing the .svg) again.
const blobUrlByCardName = new Map<string, string>();

function postcardFrontPngSrc(cardName: string): string {
  return `/assets/cards/designs/${cardName}.png`;
}

// Fetches every card design's PNG once, up front, and keeps it as a blob:
// URL so the reel never re-fetches or re-rasterizes a card front — resolves
// once every image has loaded (or failed) so callers can wait out the
// warm-up (the reel does, alongside its first data fetch).
export function preloadPostcardImages(): Promise<void> {
  const loads = POSTCARD_IMAGES.map((image) => {
    const url = typeof image === 'string' ? image : image.url;
    const cardName = cardNameFromUrl(url);
    return fetch(postcardFrontPngSrc(cardName))
      .then((response) => (response.ok ? response.blob() : Promise.reject()))
      .then((blob) => {
        blobUrlByCardName.set(cardName, URL.createObjectURL(blob));
      })
      .catch(() => undefined);
  });
  return Promise.all(loads).then(() => undefined);
}

// The one place every consumer (featured card, falling-cards backdrop) asks
// for a card front: hands back the preloaded blob: URL once
// preloadPostcardImages() has run for it, falling back to the plain PNG path
// if that hasn't happened (or failed) yet so the image still renders, just
// without the shared, cached bytes.
export function postcardFrontSrc(cardName: string): string {
  return blobUrlByCardName.get(cardName) ?? postcardFrontPngSrc(cardName);
}
