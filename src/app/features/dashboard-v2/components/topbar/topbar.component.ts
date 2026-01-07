import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../auth/auth.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-topbar-v2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css',
})
export class TopbarV2Component {
  private readonly auth = inject(AuthService);
  @Input() env: 'DEV' | 'TEST' | 'PROD' = (() => {
    if (environment.production) {
      return 'PROD';
    }

    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host.includes('test') || host.includes('qa') || host.includes('staging')) {
        return 'TEST';
      }
    }

    return 'DEV';
  })();
  @Input() roleLabel: string = (this.auth.user?.role || 'Guest').toUpperCase();
  @Input() displayName: string = (this.auth.user?.firstName + ' ' + this.auth.user?.lastName || 'Guest').toUpperCase();

}
