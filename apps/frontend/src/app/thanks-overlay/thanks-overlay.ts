import { Component, OnInit } from '@angular/core';
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
}
