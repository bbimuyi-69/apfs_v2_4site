import { Component, ChangeDetectorRef, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TopbarV2Component } from './components/topbar/topbar.component';
import { NavRailComponent } from './components/nav-rail/nav-rail.component';
import { StatusCardsComponent } from './components/status-cards/status-cards.component';
import { WorkflowHealthComponent } from './components/workflow-health/workflow-health.component';
import { DashboardFiltersComponent } from './components/dashboard-filters/dashboard-filters.component';
import { RecordsTableComponent } from './components/records-table/records-table.component';
import { RecordDrawerComponent } from './components/record-drawer/record-drawer.component';

import { ForecastRecordService } from '../forecast/forecast-record/forecast-record/forecast-record.service';
import { ForecastRecord, ForecastRecordStatus } from '../forecast/forecast-record/models/forecast-record.model';
import { AuthService } from '../../auth/auth.service';
import { DashboardFilters, StatusCount } from './models/dashboard-v2.models';

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
  ) {}

  readonly rows = signal<ForecastRecord[]>([]);
  readonly selected = signal<ForecastRecord | null>(null);

  readonly env = signal<'DEV'|'TEST'|'PROD'>('DEV');
  readonly roleLabel = signal<string>('User');
  readonly displayName = signal<string>('User');
  readonly userEmail = signal<string>('Unknown');

  readonly filters = signal<DashboardFilters>({
    q: '',
    status: 'All',
    sort: 'updated_desc',
    mineClaimed: false,
    mineSubmitted: false,
  });

  private readonly WORKABLE_STATUSES = new Set<string>(['Draft','Submitted','InReview','NeedsInfo']);

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
      // pick first visible role label
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
      }
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

  readonly workableRows = computed(() => this.rows().filter(r => this.WORKABLE_STATUSES.has(String((r as any).status ?? 'Draft'))));

  readonly statusCounts = computed<StatusCount[]>(() => {
    const list = this.rows();
    const statuses: ForecastRecordStatus[] = ['Draft','Submitted','InReview','NeedsInfo','Approved','Rejected','Completed'];
    return statuses.map(s => ({ status: s, count: list.filter(r => r.status === s).length }));
  });

  readonly filteredRows = computed(() => {
    let list = [...this.rows()];
    const f = this.filters();
    const myId = this.getMyUserId();

    if (f.status !== 'All') list = list.filter(r => r.status === f.status);

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
      list = list.filter(r => String((r as any).submittedBy ?? '') === myId || String((r as any).submittedBy ?? '') === this.userEmail());
    }

    list.sort((a: any, b: any) => {
      const ta = new Date(a?.updatedAt ?? a?.createdAt ?? 0).getTime();
      const tb = new Date(b?.updatedAt ?? b?.createdAt ?? 0).getTime();
      return f.sort === 'updated_desc' ? (tb - ta) : (ta - tb);
    });

    return list;
  });

  onSelect(row: ForecastRecord){ this.selected.set(row); }
  onCloseDrawer(){ this.selected.set(null); }
  onFiltersChange(next: DashboardFilters){ this.filters.set(next); }

  onPickStatus(status: string){
    // clicking a status card sets filter and scrolls to table naturally
    this.filters.set({ ...this.filters(), status: status as any });
  }
}
