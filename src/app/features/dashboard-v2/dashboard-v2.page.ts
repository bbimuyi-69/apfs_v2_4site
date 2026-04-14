import { Component, ChangeDetectorRef, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { HttpClient, HttpClientModule } from '@angular/common/http';

import { TopbarV2Component } from './components/topbar/topbar.component';
import { NavRailComponent } from './components/nav-rail/nav-rail.component';
import { StatusCardsComponent } from './components/status-cards/status-cards.component';
import { WorkflowHealthComponent } from './components/workflow-health/workflow-health.component';
import { DashboardFiltersComponent } from './components/dashboard-filters/dashboard-filters.component';
import { RecordsTableComponent } from './components/records-table/records-table.component';
import { RecordDrawerComponent } from './components/record-drawer/record-drawer.component';

import { ForecastRecordService } from '../forecast/forecast-record/services/forecast-record.service';
import { ForecastRecord } from '../forecast/forecast-record/models/forecast-record.model';
import { AuthService } from '../../auth/auth.service';
import { DashboardFilters, StatusCount } from './models/dashboard-v2.models';
import { environment } from '../../../environments/environment';
import { ForecastWorkflowLane } from '../forecast/forecast-record/models/forecast-record.enums';

type ForecastView = 'claimed' | 'office' | 'activity';


@Component({
  selector: 'app-dashboard-v2',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    TopbarV2Component,
    NavRailComponent,
    StatusCardsComponent,
    WorkflowHealthComponent,
    DashboardFiltersComponent,
    RecordsTableComponent,
    RecordDrawerComponent,
  ],
  templateUrl: './dashboard-v2.page.html',
  styleUrl: './dashboard-v2.page.css',
})
export class DashboardV2Page implements OnInit {
  isRecordRoute = false;
  constructor(
    private auth: AuthService,
    private forecastService: ForecastRecordService, // (kept for now; not used for the 3 new views yet)
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) { }

  // Core state


  readonly rows = signal<ForecastRecord[]>([]);
  readonly selected = signal<ForecastRecord | null>(null);

  // View state (Claimed default)
  readonly currentView = signal<ForecastView>('claimed');
  readonly isLoading = signal<boolean>(false);

  // Header/user
  readonly env = signal<'DEV' | 'TEST' | 'PROD'>('DEV');
  readonly roleLabel = signal<string>('User');
  readonly displayName = signal<string>('User');
  readonly userEmail = signal<string>('Unknown');

  // Filters
  readonly filters = signal<DashboardFilters>({
    q: '',
    status: 'All',          // now interpreted as workflow lane label, e.g. 'Draft'
    sort: 'updated_desc',
    mineClaimed: false,
    mineSubmitted: false,
  });

  // ✅ Workflow lanes that are "workable" (i.e., not final)
  private readonly WORKABLE_LANES = new Set<ForecastWorkflowLane>([
    ForecastWorkflowLane.Draft,
    ForecastWorkflowLane.Requirements,
    ForecastWorkflowLane.Contracting,
    ForecastWorkflowLane.APFSCoordinator,
  ]);

  ngOnInit(): void {
    const a: any = this.auth as any;
    const u =
      a?.currentUser ??
      (typeof a?.getCurrentUser === 'function' ? a.getCurrentUser() : null);

    if (u) {
      this.userEmail.set(u.email ?? u.upn ?? u.username ?? 'Unknown');
      this.displayName.set(u.displayName ?? u.name ?? 'User');

      const rawRoles =
        u.roles ??
        u.role ??
        a?.roles ??
        (typeof a?.getRoles === 'function' ? a.getRoles() : []);

      const roles = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [String(rawRoles)] : [];
      this.roleLabel.set(roles[0] ?? 'User');
    }

    // initial route check
    this.isRecordRoute = this.router.url.startsWith('/forecast/');

    // keep updated on navigation
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.isRecordRoute = e.urlAfterRedirects.startsWith('/forecast/');
      });

    // Default dashboard view: Claimed
    this.loadView('claimed');
  }

  /**
   * Reload current view
   */
  refresh(): void {
    this.loadView(this.currentView());
  }

  /**
   * Called by your dashboard buttons (Claimed / Office / Activity)
   */
  setView(view: ForecastView): void {
    if (this.currentView() === view) return;

    // optional: close drawer when changing views
    this.selected.set(null);

    this.loadView(view);
  }

  /**
   * Backend-driven list loading.
   * Expects: GET /api/forecast-records/{claimed|office|activity} -> { rows, total }
   */
  private loadView(view: ForecastView): void {
    this.isLoading.set(true);
    this.currentView.set(view);

    this.http.get<{ rows: ForecastRecord[]; total: number }>(`${environment.apiBaseUrl}/forecast-records/${view}`).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.rows) ? res.rows : [];
        this.rows.set(rows);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.rows.set([]);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  private getMyUserId(): string {
    const a: any = this.auth as any;
    const u =
      a?.currentUser ??
      (typeof a?.getCurrentUser === 'function' ? a.getCurrentUser() : null);

    return (
      u?.id ??
      u?.userId ??
      u?.oid ??
      u?.sub ??
      u?.upn ??
      u?.email ??
      ''
    );
  }

  /**
   * ✅ Canonical lane accessor for dashboard
   * Prefer workflowStatus; fall back to legacy status.
   */
  private getLane(r: ForecastRecord): ForecastWorkflowLane {
    const lane = (r as any).workflowStatus ?? (r as any).status ?? ForecastWorkflowLane.Draft;

    // If API ever sends unknown strings, coerce safely
    if (
      lane === ForecastWorkflowLane.Draft ||
      lane === ForecastWorkflowLane.Requirements ||
      lane === ForecastWorkflowLane.Contracting ||
      lane === ForecastWorkflowLane.APFSCoordinator ||
      lane === ForecastWorkflowLane.Published
    ) {
      return lane;
    }

    return ForecastWorkflowLane.Draft;
  }

  getToLane(r: ForecastRecord): ForecastWorkflowLane {
    return this.getLane(r);
  }

  getFromLane(r: ForecastRecord): ForecastWorkflowLane | '—' {
    switch (this.getLane(r)) {
      case ForecastWorkflowLane.Draft:
        return '—';
      case ForecastWorkflowLane.Requirements:
        return ForecastWorkflowLane.Draft;
      case ForecastWorkflowLane.Contracting:
        return ForecastWorkflowLane.Requirements;
      case ForecastWorkflowLane.APFSCoordinator:
        return ForecastWorkflowLane.Contracting;
      case ForecastWorkflowLane.Published:
        return ForecastWorkflowLane.APFSCoordinator;
      default:
        return '—';
    }
  }

  formatLane(lane: ForecastWorkflowLane | '—'): string {
    if (lane === '—') return '—';

    switch (lane) {
      case ForecastWorkflowLane.Draft:
        return 'Draft';
      case ForecastWorkflowLane.Requirements:
        return 'Requirements';
      case ForecastWorkflowLane.Contracting:
        return 'Contracting';
      case ForecastWorkflowLane.APFSCoordinator:
        return 'APFS Coordinator';
      case ForecastWorkflowLane.Published:
        return 'Published';
      default:
        return String(lane);
    }
  }

  getWorklaneLabel(r: ForecastRecord): string {
    return `${this.formatLane(this.getFromLane(r))} → ${this.formatLane(this.getToLane(r))}`;
  }
  //end new derived lane accessors

  // Computeds
  readonly workableRows = computed(() =>
    this.rows().filter(r => this.WORKABLE_LANES.has(this.getLane(r)))
  );

  /**
   * ✅ Counts by workflow lane (your 5 states)
   */
  readonly statusCounts = computed<StatusCount[]>(() => {
    const list = this.rows();
    const lanes: ForecastWorkflowLane[] = [
      ForecastWorkflowLane.Draft,
      ForecastWorkflowLane.Requirements,
      ForecastWorkflowLane.Contracting,
      ForecastWorkflowLane.APFSCoordinator,
      ForecastWorkflowLane.Published,
    ];

    return lanes.map(lane => ({
      status: lane as any,
      count: list.filter(r => this.getLane(r) === lane).length,
    }));
  });

  readonly recordCount = computed(() => this.filteredRows().length);

  readonly filteredRows = computed(() => {
    let list = [...this.rows()];
    const f = this.filters();
    const myId = this.getMyUserId();

    // existing filters...

    // 🔥 ADD THIS MAPPING STEP
    return list.map(r => ({
      ...r,
      worklaneFrom: this.formatLane(this.getFromLane(r)),
      worklaneTo: this.formatLane(this.getToLane(r)),
    }));
  });

  // UI handlers
  onSelect(row: ForecastRecord): void {
    this.selected.set(row);
  }

  onCloseDrawer(): void {
    this.selected.set(null);
  }

  onFiltersChange(next: DashboardFilters): void {
    this.filters.set(next);
  }

  onPickStatus(status: string): void {
    this.filters.set({ ...this.filters(), status: status as any });
  }

  openRecord(row: ForecastRecord): void {
    this.selected.set(row);
  }

  createNewForecastRecord(): void {
    this.router.navigate(['/forecast/new']);
  }

  // 🔥 called when drawer emits updated record (ex: after claim)
  onRecordUpdated(updated: ForecastRecord): void {
    this.rows.update(list => list.map(r => (r.id === updated.id ? updated : r)));

    const cur = this.selected();
    if (cur?.id === updated.id) {
      this.selected.set(updated);
    }

    this.cdr.detectChanges();
  }
}