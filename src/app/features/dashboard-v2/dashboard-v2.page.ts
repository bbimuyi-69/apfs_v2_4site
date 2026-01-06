import { Component, ChangeDetectorRef, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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

import { ForecastWorkflowLane } from '../forecast/forecast-record/models/forecast-record.enums';

@Component({
  selector: 'app-dashboard-v2',
  standalone: true,
  imports: [
    CommonModule,
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
  constructor(
    private auth: AuthService,
    private forecastService: ForecastRecordService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) { }

  // Core state
  readonly rows = signal<ForecastRecord[]>([]);
  readonly selected = signal<ForecastRecord | null>(null);

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

    this.refresh();
  }

  refresh(): void {
    this.forecastService.list().subscribe({
      next: (rows) => {
        this.rows.set(Array.isArray(rows) ? rows : []);
        this.cdr.detectChanges();
      },
      error: () => {
        this.rows.set([]);
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

  // Computeds
  readonly workableRows = computed(() =>
    this.rows().filter(r => this.WORKABLE_LANES.has(this.getLane(r)))
  );

  /**
   * ✅ Counts by workflow lane (your 5 states)
   * NOTE: StatusCount.status is typed in your models; if it expects string, enum values are strings, so fine.
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

  readonly filteredRows = computed(() => {
    let list = [...this.rows()];
    const f = this.filters();
    const myId = this.getMyUserId();

    // ✅ Filter by workflow lane (Draft/Requirements/Contracting/APFS Coordinator/Published)
    if (f.status !== 'All') {
      list = list.filter(r => String(this.getLane(r)) === String(f.status));
    }

    if (f.q.trim()) {
      const q = f.q.toLowerCase();
      list = list.filter(r =>
        String(r.apfsNumber ?? '').toLowerCase().includes(q) ||
        String(r.requirementsTitle ?? '').toLowerCase().includes(q) ||
        String(r.component ?? '').toLowerCase().includes(q)
      );
    }

    if (f.mineClaimed && myId) {
      list = list.filter(r => String((r as any).assignedToUserId ?? '') === myId);
    }

    if (f.mineSubmitted && myId) {
      list = list.filter(r =>
        String((r as any).submittedBy ?? '') === myId ||
        String((r as any).submittedBy ?? '') === this.userEmail()
      );
    }

    list.sort((a: any, b: any) => {
      const ta = new Date(a?.updatedAt ?? a?.createdAt ?? 0).getTime();
      const tb = new Date(b?.updatedAt ?? b?.createdAt ?? 0).getTime();
      return f.sort === 'updated_desc' ? (tb - ta) : (ta - tb);
    });

    return list;
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
