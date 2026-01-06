import { Component, OnInit, computed, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

import { ForecastRecordService } from '../../features/forecast/forecast-record/services/forecast-record.service';
import { ForecastRecord } from '../../features/forecast/forecast-record/models/forecast-record.model';

type ClaimedRecord = {
  id: number;
  apfsNumber: string;
  currentState: string;
  completionStatus: string;
};

type QueueRecord = {
  id: number;
  apfsNumber: string;
  office: string;
  status: string;
};

type ActivityRow = {
  id?: number;
  apfsNumber: string;
  movedFrom: string;
  movedTo: string;
  assignedTo: string;
  assignedBy: string;
  time: string;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class Dashboard implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router,
    private forecastService: ForecastRecordService,
    private cdr: ChangeDetectorRef
  ) { }

  warningText =
    'This system is not authorized for the processing or storage of sensitive or classified information.';

  // -------- Auth wiring (defensive — adapt later to your real AuthService shape) --------
  readonly userEmail = signal<string>('Unknown');
  readonly displayName = signal<string>('User');
  readonly roles = signal<string[]>([]);

  readonly isAuthenticated = computed(() => {
    const a: any = this.auth as any;
    if (typeof a?.isAuthenticated === 'function') return !!a.isAuthenticated();
    if (typeof a?.isLoggedIn === 'function') return !!a.isLoggedIn();
    return true;
  });

  readonly isCoordinator = computed(() => {
    const r = this.roles().map((x) => String(x).toLowerCase());
    return r.includes('apfs coordinator') || r.includes('coordinator');
  });

  readonly isAdmin = computed(() => {
    const r = this.roles().map((x) => String(x).toLowerCase());
    return r.includes('admin') || r.includes('administrator');
  });

  // -------- UI state / data --------
  messagesCount = 66;

  claimedRecords: ClaimedRecord[] = [];
  officeQueue: QueueRecord[] = [];
  latestActivity: ActivityRow[] = [];

  isLoadingDashboard = false;
  loadErrorText = '';

  // Keep raw records so we can re-bucket locally (no refresh)
  private allRecords: ForecastRecord[] = [];

  // Define "workable" statuses for queue/claimed buckets
  private readonly WORKABLE_STATUSES = new Set<string>([
    'Draft',
    'Submitted',
    'InReview',
    'NeedsInfo',
  ]);

  ngOnInit(): void {
    // --- hydrate auth UI bits (optional) ---
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

      this.roles.set(
        Array.isArray(rawRoles) ? rawRoles : rawRoles ? [String(rawRoles)] : []
      );
    }

    this.refreshDashboard();
    console.log('[Dashboard] ngOnInit done — calling refreshDashboard');
  }





  private refreshDashboard(): void {
    this.isLoadingDashboard = true;
    this.loadErrorText = '';
    this.cdr.detectChanges();

    this.forecastService.list().subscribe({
      next: (rows: ForecastRecord[]) => {
        try {
          this.allRecords = Array.isArray(rows) ? [...rows] : [];
          this.rebuildBuckets();
        } catch (err) {
          console.error(err);
          this.loadErrorText = 'Dashboard failed while processing records.';
        } finally {
          this.isLoadingDashboard = false;
          this.cdr.detectChanges(); // <-- key line
        }
      },
      error: (e) => {
        console.error(e);
        this.loadErrorText = 'Failed to load forecast records.';
        this.isLoadingDashboard = false;
        this.cdr.detectChanges(); // <-- key line
      },
    });
  }



  // -------- Bucket logic (Queue vs Claimed) --------
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

  private isWorkable(r: ForecastRecord): boolean {
    const status = String((r as any).status ?? 'Draft');
    return this.WORKABLE_STATUSES.has(status);
  }

  private assignedToUserId(r: ForecastRecord): string {
    return String((r as any).assignedToUserId ?? '').trim();
  }

  private assignedToName(r: ForecastRecord): string {
    return String((r as any).assignedToName ?? (r as any).lastUpdatedBy ?? '—');
  }

  private recordTime(r: ForecastRecord): string {
    return String((r as any).updatedAt ?? (r as any).createdAt ?? '');
  }

  private rebuildBuckets(): void {
    const myUserId = this.getMyUserId();

    // newest-first by updatedAt/createdAt (falls back to 0)
    const sorted = [...this.allRecords].sort((a: any, b: any) => {
      const ta = new Date(a?.updatedAt ?? a?.createdAt ?? 0).getTime();
      const tb = new Date(b?.updatedAt ?? b?.createdAt ?? 0).getTime();
      return tb - ta;
    });

    const workable = sorted.filter((r) => this.isWorkable(r));

    const queue = workable.filter((r) => !this.assignedToUserId(r));
    const claimedByMe = workable.filter(
      (r) => this.assignedToUserId(r) && this.assignedToUserId(r) === myUserId
    );

    // Claimed Records (mine)
    this.claimedRecords = claimedByMe
      .filter((r) => typeof r.id === 'number')
      .slice(0, 10)
      .map((r) => ({
        id: r.id as number,
        apfsNumber: r.apfsNumber ?? String(r.id ?? ''),
        currentState: String((r as any).status ?? 'Draft'),
        completionStatus: String((r as any).status ?? 'Draft'),
      }));

    // Office Queue (unassigned)
    this.officeQueue = queue
      .filter((r) => typeof r.id === 'number')
      .slice(0, 10)
      .map((r) => ({
        id: r.id as number,
        apfsNumber: r.apfsNumber ?? String(r.id ?? ''),
        office: (r as any).office ?? r.component ?? '—',
        status: String((r as any).status ?? 'Draft'),
      }));

    // Latest Activity (simple)
    this.latestActivity = sorted.slice(0, 10).map((r) => ({
      id: typeof r.id === 'number' ? (r.id as number) : undefined,
      apfsNumber: r.apfsNumber ?? String(r.id ?? ''),
      movedFrom: '—',
      movedTo: String((r as any).status ?? 'Draft'),
      assignedTo: this.assignedToName(r),
      assignedBy: String((r as any).lastUpdatedBy ?? '—'),
      time: this.recordTime(r),
    }));
  }

  // -------- Navigation / actions --------
  goToMessages(): void {
    this.router.navigateByUrl('/messages');
  }

  startNewForecastRecord(): void {
    this.router.navigate(['/forecast/new']);
  }

  openRecord(id: number): void {
    this.router.navigate(['/forecast', String(id)]);
  }

  /**
   * Claim immediately (no navigation, no page refresh).
   * Requires ForecastRecordService.claim(id, payload) (we added earlier).
   */
  claim(record: QueueRecord): void {
    if (!this.isCoordinator() && !this.isAdmin()) return;

    const myUserId = this.getMyUserId();
    const myName = this.displayName();

    const svc: any = this.forecastService as any;
    if (typeof svc?.claim !== 'function') {
      console.error('ForecastRecordService.claim() is not implemented yet.');
      return;
    }

    svc.claim(record.id, { userId: myUserId, userName: myName }).subscribe({
      next: (updated: ForecastRecord) => {
        const idx = this.allRecords.findIndex((r) => r.id === updated.id);
        if (idx >= 0) this.allRecords[idx] = updated;
        else this.allRecords.unshift(updated);

        this.rebuildBuckets();
      },
      error: (e: any) => {
        console.error('Claim failed', e);
      },
    });
  }

  unclaim(record: { id: number }): void {
    if (!this.isCoordinator() && !this.isAdmin()) return;

    const myUserId = this.getMyUserId();

    const svc: any = this.forecastService as any;
    if (typeof svc?.unclaim !== 'function') {
      console.error('ForecastRecordService.unclaim() is not implemented yet.');
      return;
    }

    svc.unclaim(record.id, { userId: myUserId }).subscribe({
      next: (updated: ForecastRecord) => {
        const idx = this.allRecords.findIndex((r) => r.id === updated.id);
        if (idx >= 0) this.allRecords[idx] = updated;
        else this.allRecords.unshift(updated);

        this.rebuildBuckets();
      },
      error: (e: any) => {
        console.error('Unclaim failed', e);
      },
    });
  }


  logout(): void {
    const a: any = this.auth as any;
    if (typeof a?.logout === 'function') a.logout();
    this.router.navigateByUrl('/welcome');
  }
}
