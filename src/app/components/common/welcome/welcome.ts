import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf, JsonPipe } from '@angular/common';
import { AuthService } from '../../../auth/auth.service'; // adjust path if needed

@Component({
  standalone: true,
  imports: [RouterLink, NgIf, JsonPipe],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  constructor() {
    console.log('WELCOME auth.user =', this.auth.user);
    console.log('WELCOME session =', this.auth.session);
  }

  navigateToGovAccess() {
    this.router.navigate(['/rob']);
  }

  navigateToRegularAccess() {
    this.router.navigate(['/request-new-user']);
  }
}