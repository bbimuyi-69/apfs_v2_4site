import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, ElementRef } from '@angular/core';
import { RouterModule, RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map } from 'rxjs/operators';

import { Header } from './core/layout/header/header';
import { AuthService } from './auth/auth.service';
import { ThemeService } from './core/Theme/theme.service';
import { DocLink, getDocumentationLinkForRole } from './features/dashboard-v2/components/nav-rail/nav-rail.helper';

type DropdownKey = 'government' | 'documentation' | 'reports' | 'userProfile';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, FormsModule, Header],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  title = '';
  searchTerm = '';
  profilePanelOpen = false;

  private readonly el = inject(ElementRef<HTMLElement>);

  public readonly auth = inject(AuthService);

  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly themeService = inject(ThemeService);

  dropdowns: Record<DropdownKey, boolean> = {
    government: false,
    documentation: false,
    reports: false,
    userProfile: false,
  };

  constructor() {
    if (this.auth.isLoggedIn) {
      this.auth.loadMe().subscribe({ error: () => { } });
    }

    void this.themeService;

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
        this.closeProfilePanel();
      });
  }

  onSearch(): void {
    const term = this.searchTerm?.trim();

    this.router.navigate(['/search'], {
      queryParams: { q: term },
      queryParamsHandling: 'merge'
    });
  }

  logout(): void {
    this.auth.logout();
    this.closeDropdowns();
    this.closeProfilePanel();
    this.router.navigate(['/welcome']);
  }

  toggleDropdown(key: DropdownKey, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();

    const next = !this.dropdowns[key];
    this.closeDropdowns();
    this.dropdowns[key] = next;
  }

  openProfilePanel(): void {
    this.closeDropdowns();
    this.profilePanelOpen = true;
  }

  closeProfilePanel(): void {
    this.profilePanelOpen = false;
  }

  closeDropdowns(): void {
    this.dropdowns.government = false;
    this.dropdowns.documentation = false;
    this.dropdowns.reports = false;
    this.dropdowns.userProfile = false;
  }

  get documentationLink(): DocLink {
    return getDocumentationLinkForRole(this.auth.user?.role);
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
    if (ev.key === 'Escape') {
      this.closeDropdowns();
      this.closeProfilePanel();
    }
  }
}