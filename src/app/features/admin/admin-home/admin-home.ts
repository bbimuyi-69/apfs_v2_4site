import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-home.html',
  styleUrls: ['./admin-home.css'],
})
export class AdminHome {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  goUsers(): void {
    this.router.navigateByUrl('/admin/users');
  }


  goOrganizations(): void {
    this.router.navigateByUrl('/admin/organization');
  }


  goOffices(): void {
    this.router.navigateByUrl('/admin/offices');
  }

  goPicklists(): void {
    this.router.navigateByUrl('/admin/picklists');
  }
}
