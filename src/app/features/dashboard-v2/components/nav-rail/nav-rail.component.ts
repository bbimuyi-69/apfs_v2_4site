import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../../../auth/auth.service';
import { DocLink, getDocumentationLinkForRole, canSeeNewRequest } from './nav-rail.helper';

@Component({
  selector: 'app-nav-rail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav-rail.component.html',
  styleUrls: ['./nav-rail.component.css'],
})
export class NavRailComponent {
  private readonly auth = inject(AuthService);

  get documentationLink(): DocLink {
    return getDocumentationLinkForRole(this.auth.user?.role);
  }

  get showNewRequest(): boolean {
    return canSeeNewRequest(this.auth.user?.role);
  }
}
