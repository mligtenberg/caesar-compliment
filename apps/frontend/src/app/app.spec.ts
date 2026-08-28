import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicClientApplication } from '@azure/msal-browser';
import { MSAL_INSTANCE, MsalService } from '@azure/msal-angular';
import { App } from './app';
import { msalConfig } from './auth-config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: MSAL_INSTANCE, useValue: new PublicClientApplication(msalConfig) },
        MsalService,
      ],
    }).compileComponents();
  });

  it('should create the app', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
