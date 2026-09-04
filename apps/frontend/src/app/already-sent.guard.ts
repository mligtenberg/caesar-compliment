import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiClientService } from './api-client.service';
import { postcardFrontSrc, postcardIsLandscape } from './postcard-rack/postcard-images';
import { ThanksDataService } from './thanks-overlay/thanks-data.service';
import { renderFinishedPostcardBackLandscape } from './postcard-rack/postcard-back-renderer';

// A user can only ever send one compliment (see backend: RowKey is the sender's
// own object id). If they already have, skip straight to the thanks screen
// instead of letting them go through the selection flow again.
export const alreadySentGuard: CanActivateFn = async () => {
  const apiClient = inject(ApiClientService);
  const thanksData = inject(ThanksDataService);
  const router = inject(Router);

  const compliment = await apiClient.getMine();
  if (!compliment) return true;

  thanksData.set({
    frontSrc: postcardFrontSrc(compliment.cardName),
    frontIsLandscape: postcardIsLandscape(compliment.cardName),
    backSrc: renderFinishedPostcardBackLandscape(compliment.text, compliment.recipientName),
    text: compliment.text,
    recipientName: compliment.recipientName,
    cardName: compliment.cardName,
    hideFromDashboard: compliment.hideFromDashboard,
  });

  return router.createUrlTree(['/thanks']);
};
