import { Route } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { alreadySentGuard } from './already-sent.guard';
import { appStateGuard } from './app-state.guard';
import { adminGuard } from './admin/admin.guard';
import { Admin } from './admin/admin';
import { RoleAssignmentPage } from './admin/role-assignment/role-assignment';
import { AdminCompliments } from './admin/compliments/admin-compliments';
import { AppStatePage } from './admin/app-state/app-state';
import { LockedOverlay } from './locked-overlay/locked-overlay';
import { ReceiveOverlay } from './receive-overlay/receive-overlay';
import { PostcardRack } from './postcard-rack/postcard-rack';
import { RecipientSearch } from './recipient-search/recipient-search';
import { ThanksOverlay } from './thanks-overlay/thanks-overlay';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [MsalGuard],
    children: [
      { path: '', component: RecipientSearch, canActivate: [appStateGuard, alreadySentGuard] },
      { path: 'rack', component: PostcardRack, canActivate: [appStateGuard, alreadySentGuard] },
      { path: 'thanks', component: ThanksOverlay },
      { path: 'locked', component: LockedOverlay },
      { path: 'receiving', component: ReceiveOverlay },
      {
        path: 'admin',
        component: Admin,
        canActivate: [adminGuard],
        children: [
          { path: '', redirectTo: 'roles', pathMatch: 'full' },
          { path: 'roles', component: RoleAssignmentPage },
          { path: 'compliments', component: AdminCompliments },
          { path: 'status', component: AppStatePage },
        ],
      },
    ],
  },
];
