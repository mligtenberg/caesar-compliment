import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThanksDataService } from './thanks-data.service';

@Component({
  selector: 'app-thanks-overlay',
  templateUrl: './thanks-overlay.html',
  styleUrl: './thanks-overlay.css',
})
export class ThanksOverlay implements OnInit {
  protected readonly thanks;

  constructor(
    private readonly thanksData: ThanksDataService,
    private readonly router: Router
  ) {
    this.thanks = this.thanksData.data;
  }

  ngOnInit(): void {
    if (!this.thanks()) {
      this.router.navigateByUrl('/');
    }
  }

  // A tab reopened from the browser's bfcache resumes this exact frozen page
  // (compliment and images still shown) without any navigation event firing,
  // so ngOnInit never reruns. event.persisted is the browser's own signal that
  // this is a bfcache restore rather than a real navigation - bounce home.
  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
      this.router.navigateByUrl('/');
    }
  }
}
