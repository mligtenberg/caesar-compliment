import { Route } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { alreadySentGuard } from './already-sent.guard';
import { PostcardRack } from './postcard-rack/postcard-rack';
import { RecipientSearch } from './recipient-search/recipient-search';
import { ThanksOverlay } from './thanks-overlay/thanks-overlay';

export const appRoutes: Route[] = [
  { path: '', component: RecipientSearch, canActivate: [MsalGuard, alreadySentGuard] },
  { path: 'rack', component: PostcardRack, canActivate: [MsalGuard, alreadySentGuard] },
  { path: 'thanks', component: ThanksOverlay, canActivate: [MsalGuard] },
];
