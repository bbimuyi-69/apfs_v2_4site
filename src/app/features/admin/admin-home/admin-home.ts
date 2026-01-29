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

  
  goLookups(): void {
    this.router.navigateByUrl('/admin/lookups');
  }
}
