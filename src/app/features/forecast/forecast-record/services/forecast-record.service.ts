import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, delay, map } from 'rxjs';

import { environment } from 'src/environments/environment';

import { ForecastRecord } from '../models/forecast-record.model';
import { createEmptyForecastRecord } from '../models/forecast-record.factory';
import { ForecastWorkflowLane } from '../models/forecast-record.enums';
import { AuthService } from 'src/app/auth/auth.service'; // adjust path

export type ForecastRecordQuery = {
  q?: string;
  status?: string | 'All'; // filter string (UI/query), not the model property
  assigned?: 'claimed' | 'unclaimed' | 'all';
  page?: number;
  pageSize?: number;
  sort?: 'updatedAt:desc' | 'updatedAt:asc' | 'createdAt:desc' | 'createdAt:asc';
};

export interface ForecastRecordPage {
  page: number;
  pageSize: number;
  total: number;
  items: ForecastRecord[];
}

// =========================
// ✅ Reject + History types
// =========================
export type RecordHistoryRow = {
  id: number;
  time: string; // ISO string
  user_display: string;
  user_comment: string;
  assignment_display?: string | null;
  latest?: 0 | 1;
  assignment_id?: string | null;
  forecast_id: number;
  new_state_id?: number | null;
  previous_state_id?: number | null;
  user_id?: string | null;
};

export type ForecastChangeLogRow = {
  id: number;
  field_name: string;
  field_new_value: string | null;
  field_old_value: string | null;
  date_changed: string;
  forecast_id: number;
  is_public?: 0 | 1 | number | null;
};

export type RejectPayload = {
  comment: string;
  userId?: string | null;
  userDisplay?: string | null;

  // optional (future): if you want to send back assigned to someone
  toUserId?: string | null;
  toDisplay?: string | null;
};

export type RejectResponse = {
  record: ForecastRecord;
  historyRow: RecordHistoryRow;
};

@Injectable({ providedIn: 'root' })
export class ForecastRecordService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly useMock = environment.useMockApi;

  // ✅ assumes environment.apiBaseUrl is '/api'
  private readonly baseUrl = `${environment.apiBaseUrl}/forecast-records`;

  private readonly store = new Map<string, ForecastRecord>();
  private seeded = false;

  // mock-only history store
  private historyStore?: Map<number, RecordHistoryRow[]>;

  private nowIso(): string {
    return new Date().toISOString();
  }

  private userHeaders(): { [k: string]: string } | undefined {
    const me = this.auth.user; // your AuthService getter
    const userId = me?.['id'];
    return userId ? { 'x-user-id': String(userId) } : undefined;
  }

  /**
   * Coerce anything (string/unknown) into a known workflow lane enum.
   * Keeps you safe while the DB/old seed data evolves.
   */
  private coerceLane(v: any): ForecastWorkflowLane {
    return (
      v === ForecastWorkflowLane.Draft ||
      v === ForecastWorkflowLane.Requirements ||
      v === ForecastWorkflowLane.Contracting ||
      v === ForecastWorkflowLane.APFSCoordinator ||
      v === ForecastWorkflowLane.Published
    )
      ? v
      : ForecastWorkflowLane.Draft;
  }

  /**
   * Normalize a record so workflowStatus is always a valid lane.
   * NOTE: reads legacy (any).status if present, but never stores it.
   */
  private normalize(r: any): ForecastRecord {
    const lane = this.coerceLane(r?.workflowStatus ?? r?.status);
    return {
      ...r,
      workflowStatus: lane,
    } as ForecastRecord;
  }

  // ===============================
  // MOCK SEEDING
  // ===============================
  private ensureSeeded(): void {
    if (!this.useMock || this.seeded) return;
    this.seeded = true;

    const mk = (partial: Partial<ForecastRecord> & { status?: any }) => {
      const id = Date.now() + Math.floor(Math.random() * 10000);

      // Accept either new field or legacy status from old seed snippets
      const lane = this.coerceLane((partial as any).workflowStatus ?? (partial as any).status);

      const rec: ForecastRecord = this.normalize({
        ...createEmptyForecastRecord(),
        id,
        createdAt: this.nowIso(),
        updatedAt: this.nowIso(),
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        apfsNumber: `4SITE-${String(id).slice(-5)}`,
        requirementsTitle: `Mock Requirement ${String(id).slice(-4)}`,
        ...partial,
        // Ensure workflowStatus wins even if partial had legacy string values
        workflowStatus: lane,
      });

      this.store.set(String(id), rec);
    };

    mk({ workflowStatus: ForecastWorkflowLane.Draft, component: 'CISA', programLevel: 'Program' });

    // Seed one record in Requirements lane
    mk({ workflowStatus: ForecastWorkflowLane.Requirements, component: 'HQ', programLevel: 'Division' });

    mk({
      workflowStatus: ForecastWorkflowLane.Draft,
      component: 'Ops',
      programLevel: 'Office',
      assignedToUserId: 'mock-user',
      assignedToName: 'Mock User',
      assignedAt: this.nowIso(),
    });
  }

  // ===============================
  // CRUD
  // ===============================
  getById(id: number | string): Observable<ForecastRecord> {
    const idStr = String(id);
    const currentUser = this.auth.user;
    console.log('User Data as Set by Auth', currentUser);
    if (!this.useMock) {
      return this.http
        .get<any>(`${this.baseUrl}/${encodeURIComponent(idStr)}`, { headers: this.userHeaders() })
        .pipe(map((r) => this.normalize(r)));
    }

    this.ensureSeeded();

    const existing = this.store.get(idStr);
    if (!existing) {
      const lane = ForecastWorkflowLane.Draft;

      const mock: ForecastRecord = this.normalize({
        ...createEmptyForecastRecord(),
        id: Number.isFinite(Number(idStr)) ? Number(idStr) : undefined,
        workflowStatus: lane,
        createdAt: this.nowIso(),
        updatedAt: this.nowIso(),
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        apfsNumber: `4SITE-${idStr}`,
        requirementsTitle: `Mock Requirement ${idStr}`,
      });

      this.store.set(idStr, mock);
      return of(mock).pipe(delay(150));
    }

    const normalized = this.normalize(existing);
    this.store.set(idStr, normalized);
    return of(normalized).pipe(delay(150));
  }

  create(record: ForecastRecord): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http
        .post<ForecastRecord>(this.baseUrl, record, { headers: this.userHeaders() })
        .pipe(map((r) => this.normalize(r)));
    }

    this.ensureSeeded();

    const id = Date.now();
    const now = this.nowIso();
    const currentUser = this.auth.user;
    console.log('User Data as Set by Auth', currentUser);
    const lane = this.coerceLane((record as any).workflowStatus ?? (record as any).status);

    const created: ForecastRecord = this.normalize({
      ...record,
      id,
      workflowStatus: lane,
      createdAt: record.createdAt ?? now,
      updatedAt: now,
      assignedToUserId: record.assignedToUserId ?? null,
      assignedToName: record.assignedToName ?? null,
      assignedAt: record.assignedAt ?? null,
      apfsNumber:
        record.apfsNumber ??
        `4SITE-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    });

    this.store.set(String(id), created);
    return of(created).pipe(delay(150));
  }

  update(record: ForecastRecord): Observable<ForecastRecord> {
    if (!record.id) {
      return throwError(() => new Error('ForecastRecord.id is required for update'));
    }

    if (!this.useMock) {
      return this.http
        .put<ForecastRecord>(`${this.baseUrl}/${record.id}`, record, { headers: this.userHeaders() })
        .pipe(map((r) => this.normalize(r)));
    }

    this.ensureSeeded();

    const lane = this.coerceLane((record as any).workflowStatus ?? (record as any).status);

    const updated: ForecastRecord = this.normalize({
      ...record,
      workflowStatus: lane,
      updatedAt: this.nowIso(),
    });

    this.store.set(String(record.id), updated);
    return of(updated).pipe(delay(150));
  }

  /**
   * Legacy endpoint support.
   * Prefer `advance()` for lane transitions + history.
   */
  submit(id: number, submittedBy: string | null = null): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http
        .post<ForecastRecord>(`${this.baseUrl}/${id}/submit`, { submittedBy }, { headers: this.userHeaders() })
        .pipe(map((r) => this.normalize(r)));
    }

    this.ensureSeeded();

    const existing = this.store.get(String(id));
    if (!existing) return throwError(() => new Error(`ForecastRecord ${id} not found`));

    const now = this.nowIso();

    const cur = this.coerceLane((existing as any).workflowStatus ?? (existing as any).status);

    const next =
      cur === ForecastWorkflowLane.Draft ? ForecastWorkflowLane.Requirements
        : cur === ForecastWorkflowLane.Requirements ? ForecastWorkflowLane.Contracting
          : cur === ForecastWorkflowLane.Contracting ? ForecastWorkflowLane.APFSCoordinator
            : cur === ForecastWorkflowLane.APFSCoordinator ? ForecastWorkflowLane.Published
              : ForecastWorkflowLane.Published;

    const submitted: ForecastRecord = this.normalize({
      ...existing,
      workflowStatus: next,
      submittedAt: now,
      submittedBy,
      updatedAt: now,
    });

    this.store.set(String(id), submitted);
    return of(submitted).pipe(delay(150));
  }

  // ===============================
  // LIST (paged)
  // ===============================
  list(query: ForecastRecordQuery = {}): Observable<ForecastRecordPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const assigned = query.assigned ?? 'all';
    const sort = query.sort ?? 'updatedAt:desc';
    const statusFilter = query.status ?? 'All';
    const q = query.q?.trim();

    if (!this.useMock) {
      let params = new HttpParams()
        .set('page', String(page))
        .set('pageSize', String(pageSize))
        .set('sort', sort);

      // Backend does not yet implement q/status/assigned filters, but keep wiring ready
      if (q) params = params.set('q', q);
      if (statusFilter && statusFilter !== 'All') params = params.set('status', statusFilter);
      if (assigned && assigned !== 'all') params = params.set('assigned', assigned);

      return this.http
        .get<{
          page?: number;
          pageSize?: number;
          total?: number;
          items?: any[];
          rows?: any[];
        }>(this.baseUrl, { params, headers: this.userHeaders() })
        .pipe(
          map((resp) => {

            const items = (resp.items ?? resp.rows ?? []).map((r: any) => this.normalize(r));
            return {
              page: resp.page ?? page,
              pageSize: resp.pageSize ?? pageSize,
              total: resp.total ?? items.length,
              items,
            } as ForecastRecordPage;
          })
        );
    }

    // MOCK path: keep existing in-memory paging behavior, but wrap in ForecastRecordPage
    this.ensureSeeded();

    let rows = Array.from(this.store.values()).map((r) => this.normalize(r));

    if (statusFilter !== 'All') {
      rows = rows.filter((r) => String(r.workflowStatus) === String(statusFilter));
    }

    if (assigned === 'claimed') rows = rows.filter((r) => !!r.assignedToUserId);
    else if (assigned === 'unclaimed') rows = rows.filter((r) => !r.assignedToUserId);

    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) =>
        `${r.apfsNumber ?? ''} ${r.requirementsTitle ?? ''}`.toLowerCase().includes(needle)
      );
    }

    const [field, dir] = sort.split(':') as ['updatedAt' | 'createdAt', 'asc' | 'desc'];
    rows.sort((a, b) => {
      const av = new Date((a as any)[field] ?? 0).getTime();
      const bv = new Date((b as any)[field] ?? 0).getTime();
      return dir === 'asc' ? av - bv : bv - av;
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageItems = rows.slice(start, start + pageSize);

    const pageDto: ForecastRecordPage = {
      page,
      pageSize,
      total,
      items: pageItems,
    };

    return of(pageDto).pipe(delay(150));
  }

  // =========================
  // CLAIM / UNCLAIM
  // =========================
  claim(
    id: number,
    payload?: { userId?: string | null; userName?: string | null; force?: boolean }
  ): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http
        .post<ForecastRecord>(`${this.baseUrl}/${id}/claim`, payload ?? {}, { headers: this.userHeaders() })
        .pipe(map((r) => this.normalize(r)));
    }

    this.ensureSeeded();

    const existing = this.store.get(String(id));
    if (!existing) return throwError(() => new Error(`ForecastRecord ${id} not found`));

    const me = payload?.userId ?? null;
    const assigned = existing.assignedToUserId ?? null;

    if (assigned && me && String(assigned) === String(me)) {
      return of(existing).pipe(delay(150));
    }

    if (assigned && (!payload?.force)) {
      return throwError(() => new Error(`ForecastRecord ${id} already claimed`));
    }

    const now = this.nowIso();
    const claimed: ForecastRecord = this.normalize({
      ...existing,
      assignedToUserId: me ?? 'mock-user',
      assignedToName: payload?.userName ?? 'Mock User',
      assignedAt: now,
      updatedAt: now,
    });

    this.store.set(String(id), claimed);
    return of(claimed).pipe(delay(150));
  }

  unclaim(id: number, payload?: { userId?: string | null; force?: boolean }): Observable<ForecastRecord> {
    if (!this.useMock) {
      // ✅ correct endpoint
      return this.http
        .post<ForecastRecord>(`${this.baseUrl}/${id}/unclaim`, payload ?? {}, { headers: this.userHeaders() })
        .pipe(map((r) => this.normalize(r)));
    }

    this.ensureSeeded();

    const existing = this.store.get(String(id));
    if (!existing) return throwError(() => new Error(`ForecastRecord ${id} not found`));

    if (
      existing.assignedToUserId &&
      payload?.userId &&
      existing.assignedToUserId !== payload.userId &&
      !payload.force
    ) {
      return throwError(() => new Error('Only the assignee can unclaim this record'));
    }

    const now = this.nowIso();
    const unclaimed: ForecastRecord = this.normalize({
      ...existing,
      assignedToUserId: null,
      assignedToName: null,
      assignedAt: null,
      updatedAt: now,
    });

    this.store.set(String(id), unclaimed);
    return of(unclaimed).pipe(delay(150));
  }

  /** POST /forecast-records/:id/transition
   * Server expects: { to, comment? }
   */
  transition(id: number, body: { to: string; comment?: string | null }) {
    return this.http.post<ForecastRecord>(
      `${this.baseUrl}/${id}/transition`,
      { to: body.to, comment: body.comment ?? '' },
      { headers: this.userHeaders() }
    );
  }

  // =========================
  // ✅ REJECT + HISTORY
  // =========================

  /** POST /forecast-records/:id/reject (atomic: move lane + create history row) */
  reject(id: number, payload: RejectPayload): Observable<RejectResponse> {
    if (!this.useMock) {
      return this.http
        .post<any>(`${this.baseUrl}/${id}/reject`, payload ?? {}, { headers: this.userHeaders() })
        .pipe(
          map((resp) => {
            const record = this.normalize(resp?.record ?? resp);
            const historyRow = resp?.historyRow ?? resp?.history ?? resp?.history_entry ?? null;
            return { record, historyRow } as RejectResponse;
          })
        );
    }

    this.ensureSeeded();

    const existing = this.store.get(String(id));
    if (!existing) return throwError(() => new Error(`ForecastRecord ${id} not found`));

    const comment = String(payload?.comment ?? '').trim();
    if (!comment) return throwError(() => new Error('Reject comment is required'));

    const now = this.nowIso();

    const cur = this.coerceLane((existing as any).workflowStatus ?? (existing as any).status);
    const prev = this.previousLane(cur);
    if (!prev) return throwError(() => new Error(`Cannot reject from lane ${cur}`));

    const updated: ForecastRecord = this.normalize({
      ...existing,
      workflowStatus: prev,
      status: prev, // legacy compatibility
      assignedToUserId: null,
      assignedToName: null,
      assignedAt: null,
      updatedAt: now,
    });

    this.store.set(String(id), updated);

    this.historyStore ??= new Map<number, RecordHistoryRow[]>();
    const rows = this.historyStore.get(id) ?? [];

    rows.forEach((r) => (r.latest = 0));

    const historyRow: RecordHistoryRow = {
      id: Date.now(),
      time: now,
      user_display: payload.userDisplay ?? 'Unknown',
      user_comment: comment,
      assignment_display: null,
      latest: 1,
      assignment_id: null,
      forecast_id: id,
      new_state_id: this.laneToId(prev),
      previous_state_id: this.laneToId(cur),
      user_id: payload.userId ?? null,
    };

    rows.unshift(historyRow);
    this.historyStore.set(id, rows);

    return of({ record: updated, historyRow }).pipe(delay(150));
  }

  /** GET /forecast-records/:id/history */
  getHistory(id: number): Observable<RecordHistoryRow[]> {
    if (!this.useMock) {
      return this.http.get<RecordHistoryRow[]>(`${this.baseUrl}/${id}/history`, {
        headers: this.userHeaders(),
      });
    }

    this.ensureSeeded();
    this.historyStore ??= new Map<number, RecordHistoryRow[]>();
    return of(this.historyStore.get(id) ?? []).pipe(delay(120));
  }


  getChangeLog(id: number | string): Observable<ForecastChangeLogRow[]> {
    const idStr = String(id);

    if (!this.useMock) {
      return this.http.get<ForecastChangeLogRow[]>(
        `${this.baseUrl}/${encodeURIComponent(idStr)}/change-log`,
        { headers: this.userHeaders() }
      );
    }

    // mock fallback
    return of([]).pipe(delay(150));
  }

  private previousLane(cur: ForecastWorkflowLane): ForecastWorkflowLane | null {
    if (cur === ForecastWorkflowLane.Published) return ForecastWorkflowLane.APFSCoordinator;
    if (cur === ForecastWorkflowLane.APFSCoordinator) return ForecastWorkflowLane.Contracting;
    if (cur === ForecastWorkflowLane.Contracting) return ForecastWorkflowLane.Requirements;
    if (cur === ForecastWorkflowLane.Requirements) return ForecastWorkflowLane.Draft;
    return null;
  }

  private laneToId(lane: ForecastWorkflowLane): number {
    if (lane === ForecastWorkflowLane.Draft) return 0;
    if (lane === ForecastWorkflowLane.Requirements) return 1;
    if (lane === ForecastWorkflowLane.Contracting) return 2;
    if (lane === ForecastWorkflowLane.APFSCoordinator) return 3;
    if (lane === ForecastWorkflowLane.Published) return 4;
    return 0;
  }

  // =========================
  // DELETE
  // =========================
  delete(id: number, opts: { userId?: number | null; force: boolean }) {
    let params = new HttpParams().set('force', String(opts.force));

    if (opts.userId != null) {
      params = params.set('userId', String(opts.userId));
    }

    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      params,
      headers: this.userHeaders(),
    });
  }
}
