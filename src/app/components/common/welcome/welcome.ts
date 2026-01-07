import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  imports: [],
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
