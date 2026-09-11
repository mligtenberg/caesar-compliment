import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PostcardImage, POSTCARD_IMAGES, ResolvedPostcardImage, resolvedPostcardImages } from './postcard-images';
import { ThanksData, ThanksDataService } from '../thanks-overlay/thanks-data.service';
import { ApiClientService } from '../api-client.service';

// Waits until an image src is actually decoded and ready to paint, rather
// than merely assigned — `decode()` resolves after that work is done, so
// callers can hold off showing the <img> until it won't flash in blank.
function decodeImage(src: string | null): Promise<void> {
  if (!src) return Promise.resolve();
  const img = new Image();
  img.src = src;
  return img.decode().catch(() => undefined);
}

declare global {
  interface Window {
    __POSTCARD_IMAGES__?: ResolvedPostcardImage[];
    __RECIPIENT_NAME__?: string;
    __navigateToThanks__?: (data: ThanksData) => void;
    __rackTeardown__?: () => void;
  }
}

@Component({
  selector: 'app-postcard-rack',
  templateUrl: './postcard-rack.html',
  styleUrl: './postcard-rack.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PostcardRack implements AfterViewInit, OnDestroy {
  @Input() images: (string | PostcardImage)[] = POSTCARD_IMAGES;

  protected recipientId: string | null = null;
  protected readonly recipientName = signal('');

  private rackScript: HTMLScriptElement | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly thanksData = inject(ThanksDataService);
  private readonly apiClient = inject(ApiClientService);

  private readonly updateTouchMode = () => {
    const narrowTouch =
      (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
      window.innerWidth < 640;
    document.documentElement.classList.toggle('is-touch', narrowTouch);
  };

  ngAfterViewInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.recipientId = params.get('recipientId');
    this.recipientName.set(params.get('recipientName') || '');

    window.__navigateToThanks__ = (data) => {
      if (this.recipientId) {
        this.apiClient.send({
          recipientId: this.recipientId,
          recipientName: data.recipientName,
          cardName: data.cardName,
          text: data.text,
          hideFromDashboard: data.hideFromDashboard,
        });
      }
      // Decode both card images ourselves before switching screens, so the
      // browser isn't still decoding a large data-URL PNG while the thanks
      // overlay's <img> tags are already on screen (which can show up as a
      // blank flash or a half-painted card).
      Promise.all([decodeImage(data.frontSrc), decodeImage(data.backSrc)]).finally(() => {
        this.thanksData.set(data);
        this.router.navigateByUrl('/thanks');
      });
    };

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
    window.__rackTeardown__?.();
    delete window.__rackTeardown__;
    delete window.__POSTCARD_IMAGES__;
    delete window.__RECIPIENT_NAME__;
    delete window.__navigateToThanks__;
  }

  protected changeRecipient(): void {
    this.router.navigate(['/'], {
      queryParams: { recipientId: this.recipientId, recipientName: this.recipientName() },
    });
  }

  private loadRackScript(): void {
    window.__POSTCARD_IMAGES__ = resolvedPostcardImages(this.images);
    window.__RECIPIENT_NAME__ = this.recipientName();
    const script = document.createElement('script');
    script.type = 'module';
    // Cache-bust: an ES module only ever evaluates once per exact URL, but this
    // view can remount (e.g. "Wijzigen" back to search, then picking someone
    // else) and each mount needs the module to run fresh against its new DOM.
    script.src = `/rack.js?t=${Date.now()}`;
    this.rackScript = script;
    document.body.appendChild(script);
  }
}
