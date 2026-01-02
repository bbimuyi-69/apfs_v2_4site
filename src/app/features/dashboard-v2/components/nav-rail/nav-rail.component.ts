import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../auth/auth.service';

type DocLink = { label: string; href: string };

@Component({
  selector: 'app-nav-rail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nav-rail.component.html',
  styleUrls: ['./nav-rail.component.css'],
})
export class NavRailComponent {
  private readonly auth = inject(AuthService);

  get documentationLink(): DocLink {
    const role = (this.auth.user?.role ?? '').toLowerCase();

    if (role.includes('requirements')) {
      return { label: 'Requirements', href: '/assets/docs/requirements.pdf' };

    }

    if (role.includes('contracting') || role.includes('contracting')) {
      return { label: 'Contracting Documentation', href: '/assets/docs/contracting.pdf' };

    }

    if (role.includes('coordinator') || role.includes('coordinator')) {
      return { label: 'Coordinator Documentation', href: '/assets/docs/coordinator.pdf' };

    }


    // Default: Contracting Office / CO / Admin
    return { label: 'Admin Documentation', href: '/assets/docs/admin.pdf' };

  }
}
