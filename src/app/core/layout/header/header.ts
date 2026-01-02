import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header {

  @Input() pageTitle = '';
  constructor(public auth: AuthService, private router: Router) { }



  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/user-login'); // strips any ?next=...
  }
}
