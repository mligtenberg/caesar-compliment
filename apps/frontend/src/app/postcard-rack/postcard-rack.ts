import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PostcardImage, POSTCARD_IMAGES } from './postcard-images';
import { ThanksData, ThanksDataService } from '../thanks-overlay/thanks-data.service';
import { ApiClientService } from '../api-client.service';

declare global {
  interface Window {
    __POSTCARD_IMAGES__?: (string | PostcardImage)[];
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

  private readonly updateTouchMode = () => {
    const narrowTouch =
      (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
      window.innerWidth < 640;
    document.documentElement.classList.toggle('is-touch', narrowTouch);
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly thanksData: ThanksDataService,
    private readonly apiClient: ApiClientService
  ) {}

  ngAfterViewInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.recipientId = params.get('recipientId');
    this.recipientName.set(params.get('recipientName') || '');

    window.__navigateToThanks__ = (data) => {
      this.thanksData.set(data);
      if (this.recipientId) {
        this.apiClient.send({
          recipientId: this.recipientId,
          recipientName: data.recipientName,
          cardName: data.cardName,
          text: data.text,
          hideFromDashboard: data.hideFromDashboard,
        });
      }
      this.router.navigateByUrl('/thanks');
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
    window.__POSTCARD_IMAGES__ = this.images;
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
