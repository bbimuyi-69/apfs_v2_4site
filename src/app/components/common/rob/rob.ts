import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rob',
  imports: [],
  templateUrl: './rob.html',
  styleUrl: './rob.css',
})
export class Rob {
  hasAcceptedTerms = false;

  constructor(private router: Router) { }

  acceptTerms(): void {
    this.hasAcceptedTerms = true;

    if (this.hasAcceptedTerms) {
      this.router.navigate(['/user-login']); // or whatever component
    }
  }

  declineTerms(): void {
    this.hasAcceptedTerms = false;

    // optional: route elsewhere or stay put
    this.router.navigate(['/welcome']);
  }
}
