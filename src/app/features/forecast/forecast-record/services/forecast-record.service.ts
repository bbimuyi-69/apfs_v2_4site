import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, delay } from 'rxjs';

import { environment } from 'src/environments/environment';

import { ForecastRecord } from '../models/forecast-record.model';
import { createEmptyForecastRecord } from '../models/forecast-record.factory';
import { ForecastWorkflowLane } from '../models/forecast-record.enums';

export type ForecastRecordQuery = {
  q?: string;
  status?: string | 'All';
  assigned?: 'claimed' | 'unclaimed' | 'all';
  page?: number;
  pageSize?: number;
  sort?: 'updatedAt:desc' | 'updatedAt:asc' | 'createdAt:desc' | 'createdAt:asc';
};

@Injectable({ providedIn: 'root' })
export class ForecastRecordService {
  private readonly http = inject(HttpClient);

  private readonly useMock = environment.useMockApi;

  // ✅ assumes environment.apiBaseUrl is '/api'
  private readonly baseUrl = `${environment.apiBaseUrl}/forecast-records`;

  private readonly store = new Map<string, ForecastRecord>();
  private seeded = false;

  private nowIso(): string {
    return new Date().toISOString();
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

  private ensureSeeded(): void {
    if (!this.useMock || this.seeded) return;
    this.seeded = true;

    const mk = (partial: Partial<ForecastRecord>) => {
      const id = Date.now() + Math.floor(Math.random() * 10000);

      const lane = this.coerceLane((partial as any).workflowStatus ?? (partial as any).status);

      const rec: ForecastRecord = {
        ...createEmptyForecastRecord(),
        id,
        createdAt: this.nowIso(),
        updatedAt: this.nowIso(),
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        apfsNumber: `APFS-${String(id).slice(-5)}`,
        requirementsTitle: `Mock Requirement ${String(id).slice(-4)}`,
        ...partial, // ✅ this may override workflowStatus intentionally
      };


      this.store.set(String(id), rec);
    };

    mk({ workflowStatus: ForecastWorkflowLane.Draft, component: 'CISA', programLevel: 'Program' });

    // Previously "Submitted" — in your new 5-lane model, that’s just moving to the next lane.
    // If you want seeded records in Requirements, do this:
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

  getById(id: number | string): Observable<ForecastRecord> {
    const idStr = String(id);

    if (!this.useMock) {
      return this.http.get<ForecastRecord>(`${this.baseUrl}/${encodeURIComponent(idStr)}`);
    }

    this.ensureSeeded();

    const existing = this.store.get(idStr);
    if (!existing) {
      const lane = ForecastWorkflowLane.Draft;

      const mock: ForecastRecord = {
        ...createEmptyForecastRecord(),
        id: Number.isFinite(Number(idStr)) ? Number(idStr) : undefined,

        // ✅ FIX: assign properties, don’t drop a bare enum expression
        workflowStatus: lane,
        status: lane,

        createdAt: this.nowIso(),
        updatedAt: this.nowIso(),
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        apfsNumber: `APFS-${idStr}`,
        requirementsTitle: `Mock Requirement ${idStr}`,
      };

      this.store.set(idStr, mock);
      return of(mock).pipe(delay(150));
    }

    // ✅ if older stored records exist, keep them normalized
    const normalized: ForecastRecord = {
      ...existing,
      workflowStatus: this.coerceLane((existing as any).workflowStatus ?? (existing as any).status),
      status: this.coerceLane((existing as any).status ?? (existing as any).workflowStatus),
    };

    this.store.set(idStr, normalized);
    return of(normalized).pipe(delay(150));
  }

  create(record: ForecastRecord): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.post<ForecastRecord>(this.baseUrl, record);
    }

    this.ensureSeeded();

    const id = Date.now();
    const now = this.nowIso();

    const lane = this.coerceLane((record as any).workflowStatus ?? (record as any).status);

    const created: ForecastRecord = {
      ...record,
      id,

      // ✅ keep lane fields consistent
      workflowStatus: lane,
      status: lane,

      createdAt: record.createdAt ?? now,
      updatedAt: now,
      assignedToUserId: record.assignedToUserId ?? null,
      assignedToName: record.assignedToName ?? null,
      assignedAt: record.assignedAt ?? null,
      apfsNumber:
        record.apfsNumber ??
        `APFS-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    };

    this.store.set(String(id), created);
    return of(created).pipe(delay(150));
  }

  update(record: ForecastRecord): Observable<ForecastRecord> {
    if (!record.id) {
      return throwError(() => new Error('ForecastRecord.id is required for update'));
    }

    if (!this.useMock) {
      return this.http.put<ForecastRecord>(`${this.baseUrl}/${record.id}`, record);
    }

    this.ensureSeeded();

    const lane = this.coerceLane((record as any).workflowStatus ?? (record as any).status);

    const updated: ForecastRecord = {
      ...record,
      workflowStatus: lane,
      status: lane,
      updatedAt: this.nowIso(),
    };

    this.store.set(String(record.id), updated);
    return of(updated).pipe(delay(150));
  }

  /**
   * In your new 5-lane world, "submit" should usually mean: move to the next lane,
   * not set a legacy string like 'Submitted'.
   *
   * We'll keep the endpoint name, but update lane:
   * Draft/Requirements -> Contracting, Contracting -> APFS Coordinator, Coordinator -> Published
   */
  submit(id: number, submittedBy: string | null = null): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.post<ForecastRecord>(`${this.baseUrl}/${id}/submit`, { submittedBy });
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

    const submitted: ForecastRecord = {
      ...existing,
      workflowStatus: next,
      status: next,
      submittedAt: now,
      submittedBy,
      updatedAt: now,
    };

    this.store.set(String(id), submitted);
    return of(submitted).pipe(delay(150));
  }

  list(query: ForecastRecordQuery = {}): Observable<ForecastRecord[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const assigned = query.assigned ?? 'all';
    const sort = query.sort ?? 'updatedAt:desc';
    const status = query.status ?? 'All';
    const q = query.q?.trim();

    if (!this.useMock) {
      let params = new HttpParams()
        .set('page', String(page))
        .set('pageSize', String(pageSize))
        .set('sort', sort);

      if (q) params = params.set('q', q);
      if (status && status !== 'All') params = params.set('status', status);
      if (assigned && assigned !== 'all') params = params.set('assigned', assigned);

      return this.http.get<ForecastRecord[]>(this.baseUrl, { params });
    }

    this.ensureSeeded();

    let rows = Array.from(this.store.values()).map(r => ({
      ...r,
      workflowStatus: this.coerceLane((r as any).workflowStatus ?? (r as any).status),
      status: this.coerceLane((r as any).status ?? (r as any).workflowStatus),
    }));

    if (status !== 'All') {
      rows = rows.filter((r) => String(r.workflowStatus) === String(status) || String(r.status) === String(status));
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

    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);

    return of(rows).pipe(delay(150));
  }

  claim(
    id: number,
    payload?: { userId?: string | null; userName?: string | null }
  ): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.post<ForecastRecord>(`${this.baseUrl}/${id}/claim`, payload ?? {});
    }

    this.ensureSeeded();

    const existing = this.store.get(String(id));
    if (!existing) return throwError(() => new Error(`ForecastRecord ${id} not found`));
    if (existing.assignedToUserId) return throwError(() => new Error(`ForecastRecord ${id} already claimed`));

    const now = this.nowIso();
    const claimed: ForecastRecord = {
      ...existing,
      assignedToUserId: payload?.userId ?? 'mock-user',
      assignedToName: payload?.userName ?? 'Mock User',
      assignedAt: now,
      updatedAt: now,
    };

    this.store.set(String(id), claimed);
    return of(claimed).pipe(delay(150));
  }

  unclaim(id: number, payload?: { userId?: string | null; force?: boolean }): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.post<ForecastRecord>(`${this.baseUrl}/${id}/unclaim`, payload ?? {});
    }

    this.ensureSeeded();

    const existing = this.store.get(String(id));
    if (!existing) return throwError(() => new Error(`ForecastRecord ${id} not found`));

    if (existing.assignedToUserId && payload?.userId && existing.assignedToUserId !== payload.userId && !payload.force) {
      return throwError(() => new Error('Only the assignee can unclaim this record'));
    }

    const now = this.nowIso();
    const unclaimed: ForecastRecord = {
      ...existing,
      assignedToUserId: null,
      assignedToName: null,
      assignedAt: null,
      updatedAt: now,
    };

    this.store.set(String(id), unclaimed);
    return of(unclaimed).pipe(delay(150));
  }
}
