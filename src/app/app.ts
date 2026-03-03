import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, ElementRef } from '@angular/core';
import { RouterModule, RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { Header } from './core/layout/header/header';
import { AuthService } from './auth/auth.service';
import { ThemeService } from './core/Theme/theme.service';

type DropdownKey = 'government' | 'documentation' | 'reports';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, Header],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  title = '';

  private readonly el = inject(ElementRef<HTMLElement>);

  // ✅ public so template can use auth.isLoggedIn
  public readonly auth = inject(AuthService);

  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  // ✅ inject ThemeService here (NOT inside constructor)
  private readonly themeService = inject(ThemeService);

  dropdowns: Record<DropdownKey, boolean> = {
    government: false,
    documentation: false,
    reports: false,
  };

  constructor() {
    // ✅ Restore session on refresh (dev: uses x-user-email header)
    // isLoggedIn is a GETTER -> use WITHOUT ()
    if (this.auth.isLoggedIn) {
      this.auth.loadMe().subscribe({ error: () => { } });
    }

    // ❌ REMOVE THIS (inject() not allowed here)
    // const themeService: ThemeService = inject(ThemeService);

    // (No further code needed; the service constructor applies the theme)
    // If you want to be explicit, you could reference it once:
    // void this.themeService;

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map(() => {
          let route: ActivatedRoute | null = this.activatedRoute;
          while (route.firstChild) route = route.firstChild;
          return route.snapshot.data['title'] as string | undefined;
        })
      )
      .subscribe((title) => {
        this.title = title ?? '';
        this.closeDropdowns();
      });
  }

  toggleDropdown(key: DropdownKey, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();

    const next = !this.dropdowns[key];
    this.closeDropdowns();
    this.dropdowns[key] = next;
  }

  closeDropdowns(): void {
    this.dropdowns.government = false;
    this.dropdowns.documentation = false;
    this.dropdowns.reports = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const target = ev.target as Node | null;
    if (!target) return;

    if (this.el.nativeElement.contains(target)) return;
    this.closeDropdowns();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') this.closeDropdowns();
  }
}
