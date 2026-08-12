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
