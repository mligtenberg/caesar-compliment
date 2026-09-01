import { Route } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { alreadySentGuard } from './already-sent.guard';
import { adminGuard } from './admin/admin.guard';
import { Admin } from './admin/admin';
import { RoleAssignmentPage } from './admin/role-assignment/role-assignment';
import { AdminCompliments } from './admin/compliments/admin-compliments';
import { PostcardRack } from './postcard-rack/postcard-rack';
import { RecipientSearch } from './recipient-search/recipient-search';
import { ThanksOverlay } from './thanks-overlay/thanks-overlay';

export const appRoutes: Route[] = [
  { path: '', component: RecipientSearch, canActivate: [MsalGuard, alreadySentGuard] },
  { path: 'rack', component: PostcardRack, canActivate: [MsalGuard, alreadySentGuard] },
  { path: 'thanks', component: ThanksOverlay, canActivate: [MsalGuard] },
  {
    path: 'admin',
    component: Admin,
    canActivate: [MsalGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'roles', pathMatch: 'full' },
      { path: 'roles', component: RoleAssignmentPage },
      { path: 'compliments', component: AdminCompliments },
    ],
  },
];
