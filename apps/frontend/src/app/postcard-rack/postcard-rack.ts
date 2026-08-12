import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnDestroy } from '@angular/core';
import { PostcardImage, POSTCARD_IMAGES } from './postcard-images';
import { ThanksOverlay } from '../thanks-overlay/thanks-overlay';

declare global {
  interface Window {
    __POSTCARD_IMAGES__?: (string | PostcardImage)[];
  }
}

@Component({
  selector: 'app-postcard-rack',
  imports: [ThanksOverlay],
  templateUrl: './postcard-rack.html',
  styleUrl: './postcard-rack.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PostcardRack implements AfterViewInit, OnDestroy {
  @Input() images: (string | PostcardImage)[] = POSTCARD_IMAGES;

  private rackScript: HTMLScriptElement | null = null;

  private readonly updateTouchMode = () => {
    const narrowTouch =
      (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
      window.innerWidth < 640;
    document.documentElement.classList.toggle('is-touch', narrowTouch);
  };

  ngAfterViewInit(): void {
    this.updateTouchMode();
    window.addEventListener('resize', this.updateTouchMode);

    if (customElements.get('three-d-stage')) {
      this.loadRackScript();
      return;
    }
    const stageScript = document.createElement('script');
    stageScript.src = '/three-d-stage.js';
    stageScript.onload = () => this.loadRackScript();
    document.body.appendChild(stageScript);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.updateTouchMode);
    document.documentElement.classList.remove('is-touch');
    this.rackScript?.remove();
    delete window.__POSTCARD_IMAGES__;
  }

  private loadRackScript(): void {
    window.__POSTCARD_IMAGES__ = this.images;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/rack.js';
    this.rackScript = script;
    document.body.appendChild(script);
  }
}
