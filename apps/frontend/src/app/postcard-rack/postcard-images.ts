export type PostcardOrientation = 'portrait' | 'landscape';

export interface PostcardImage {
  url: string;
  orientation?: PostcardOrientation;
}

export interface ResolvedPostcardImage {
  url: string;
  orientation: PostcardOrientation;
  name: string;
}

// Card front artwork, see libs/shared-assets/cards/designs (shared with the
// dashboard, see apps/dashboard/src/app/compliments-reel/postcard-images.ts).
// Edit this list to change which cards appear on the rack. A plain string
// defaults to portrait orientation. Filenames here are only ever used as
// identifiers (see cardNameFromUrl) — the actual asset loaded is always the
// design's .png, see postcardFrontSrc.
export const POSTCARD_IMAGES: (string | PostcardImage)[] = Array.from(
  { length: 7 },
  (_, i) => `/assets/cards/designs/${String(i + 1)}.svg`,
);

// Mirrors rack.js's cardNameFromUrl(): a card's "name" is its design filename
// without extension, the only stable identifier stored per sent compliment.
function cardNameFromUrl(url: string): string {
  const file = url.split('/').pop() ?? '';
  return file.replace(/\.[^.]+$/, '');
}

// One in-memory blob: URL per design, filled in by preloadPostcardImages() as
// each PNG finishes downloading — every other place a card front is shown
// reuses these instead of hitting the network (or rasterizing the .svg)
// again.
const blobUrlByCardName = new Map<string, string>();

function postcardFrontPngSrc(cardName: string): string {
  return `/assets/cards/designs/${cardName}.png`;
}

// Fetches every card design's PNG once, up front, and keeps it as a blob:
// URL so the rest of the app never re-fetches or re-rasterizes a card front —
// call this once, as early as possible (app boot). Resolves once every image
// has loaded (or failed) so callers can wait out the warm-up if they want to.
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

// The one place every other consumer (already-sent redirect, receive
// overlay, admin send form, the 3D rack) asks for a card front: hands back
// the preloaded blob: URL once preloadPostcardImages() has run for it,
// falling back to the plain PNG path if that hasn't happened (or failed) yet
// so the image still renders, just without the shared, cached bytes.
export function postcardFrontSrc(cardName: string): string {
  return blobUrlByCardName.get(cardName) ?? postcardFrontPngSrc(cardName);
}

export function postcardIsLandscape(cardName: string): boolean {
  const entry = POSTCARD_IMAGES.find((image) => {
    const url = typeof image === 'string' ? image : image.url;
    return url.endsWith(`/${cardName}.svg`);
  });
  if (!entry || typeof entry === 'string') return false;
  return entry.orientation === 'landscape';
}

// What the 3D rack (rack.js) actually loads onto each pocket: every entry
// resolved to its cached blob: URL (or PNG fallback) up front, carrying its
// cardName along explicitly since that can no longer be recovered by
// splitting a blob: URL's path apart.
export function resolvedPostcardImages(
  images: (string | PostcardImage)[] = POSTCARD_IMAGES,
): ResolvedPostcardImage[] {
  return images.map((image) => {
    const url = typeof image === 'string' ? image : image.url;
    const orientation = (typeof image === 'string' ? undefined : image.orientation) ?? 'portrait';
    const name = cardNameFromUrl(url);
    return { url: postcardFrontSrc(name), orientation, name };
  });
}
