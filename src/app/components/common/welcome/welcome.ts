import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  constructor(private router: Router) { }

  navigateToGovAccess() {
    this.router.navigate(['/rob']);
  }

  navigateToRegularAccess() {
    this.router.navigate(['/request-new-user']);
  }


}
