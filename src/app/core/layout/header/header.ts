import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';
import { ThemeService } from '../../Theme/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header {
  @Input() pageTitle = '';

  public readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  public readonly theme = inject(ThemeService);

  onThemeClick(): void {
    this.theme.cycleTheme();
  }

  get themeIcon(): string {
    switch (this.theme.theme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      default: return '🖥️';
    }
  }

  get themeLabel(): string {
    if (this.theme.theme === 'system') {
      // e.g. "Theme: System (dark)"
      return `Theme: System (${this.theme.resolvedTheme})`;
    }
    return this.theme.theme === 'light' ? 'Theme: Light' : 'Theme: Dark';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/user-login');
  }
}
