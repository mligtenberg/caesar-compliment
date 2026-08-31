import { Injectable, signal } from '@angular/core';

export interface ThanksData {
  frontSrc: string | null;
  frontIsLandscape: boolean;
  backSrc: string;
  text: string;
  recipientName: string;
  cardName: string;
}

@Injectable({ providedIn: 'root' })
export class ThanksDataService {
  readonly data = signal<ThanksData | null>(null);

  set(data: ThanksData): void {
    this.data.set(data);
  }
}
