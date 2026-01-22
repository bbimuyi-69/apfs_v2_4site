import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-admin-lookup',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-lookup.html',
  styleUrl: './admin-lookup.css',
})
export class AdminLookup {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  goOrganizations(): void {
    this.router.navigateByUrl('/admin/organization');
  }

  goLookups(): void {
    this.router.navigateByUrl('/admin/lookups');
  }

}
