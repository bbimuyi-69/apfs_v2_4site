import { Component, HostListener } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { Header } from './core/layout/header/header';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, Header],
  templateUrl: './app.html',
  styleUrls: ['./app.css']   // ✅ was styleUrl
})
export class App {
  title = '';

  dropdowns: { [key: string]: boolean } = {
    government: false,
    documentation: false
  };

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    // ✅ Move this here so you don't need OnInit at all
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
      });
  }

  toggleDropdown(name: string, event: Event) {
    event.preventDefault();
    this.dropdowns[name] = !this.dropdowns[name];
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      Object.keys(this.dropdowns).forEach(key => (this.dropdowns[key] = false));
    }
  }
}
