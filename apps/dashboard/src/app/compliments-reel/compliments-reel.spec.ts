import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppState } from '../api-client.service';
import { ComplimentsReel } from './compliments-reel';

// Rendered without compliments on purpose: the QR call-to-action shows
// independently of the reel, and an empty list keeps the flight timers and the
// canvas-baked card backs (jsdom has no canvas) out of the way.
function renderReel(appState: AppState | null): HTMLElement {
  const fixture = TestBed.createComponent(ComplimentsReel);
  const component = fixture.componentRef as ComponentRef<ComplimentsReel>;
  component.setInput('appState', appState);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ComplimentsReel QR call-to-action', () => {
  it('invites people to send while the app is open', () => {
    expect(renderReel('Open').querySelector('.qr-card-text')?.textContent?.trim()).toBe(
      'Ook een complimentje sturen?'
    );
  });

  it('invites people to look up their own compliment while they are being delivered', () => {
    expect(renderReel('Receive').querySelector('.qr-card-text')?.textContent?.trim()).toBe(
      'Jouw complimentje zien?'
    );
  });

  it('hides the card while the app is locked', () => {
    expect(renderReel('Locked').querySelector('.qr-card')).toBeNull();
  });

  it('hides the card until the state is known', () => {
    expect(renderReel(null).querySelector('.qr-card')).toBeNull();
  });
});
