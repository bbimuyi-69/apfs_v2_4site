import { Injectable, inject } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from 'src/environments/environment'


import { ForecastRecord } from '../models/forecast-record.model';
import { createEmptyForecastRecord } from '../models/forecast-record.factory';

export type ForecastRecordQuery = {
  q?: string;                         // free-text search (apfsNumber/title/etc)
  status?: string | 'All';            // e.g. 'Draft' | 'Submitted' | 'All'
  assigned?: 'claimed' | 'unclaimed' | 'all';
  page?: number;                      // 1-based
  pageSize?: number;
  sort?: 'updatedAt:desc' | 'updatedAt:asc' | 'createdAt:desc' | 'createdAt:asc';
};


@Injectable({ providedIn: 'root' })
export class ForecastRecordService {
  private readonly http = inject(HttpClient);

  // Configurable switches (no code edits needed later)
  private readonly useMock = environment.useMockApi;



  // Your node route is /forecast-records (no /api)
  private readonly baseUrl = `${environment.apiBaseUrl}/forecast-records`;

  // In-memory store for mock mode (keyed by id as string)
  private readonly store = new Map<string, ForecastRecord>();
  private seeded = false;

  // ---------- helpers ----------
  private nowIso(): string {
    return new Date().toISOString();
  }

  private ensureSeeded(): void {
    if (!this.useMock || this.seeded) return;
    this.seeded = true;

    const mk = (partial: Partial<ForecastRecord>) => {
      const id = Date.now() + Math.floor(Math.random() * 10000);
      const rec: ForecastRecord = {
        ...createEmptyForecastRecord(),
        id,
        status: 'Draft',
        createdAt: this.nowIso(),
        updatedAt: this.nowIso(),
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        apfsNumber: `APFS-${String(id).slice(-5)}`,
        requirementsTitle: `Mock Requirement ${String(id).slice(-4)}`,
        ...partial,
      };
      this.store.set(String(id), rec);
    };

    mk({ status: 'Draft', component: 'CISA', programLevel: 'Program' });
    mk({ status: 'Submitted', component: 'HQ', programLevel: 'Division' });
    mk({
      status: 'Draft',
      component: 'Ops',
      programLevel: 'Office',
      assignedToUserId: 'mock-user',
      assignedToName: 'Mock User',
      assignedAt: this.nowIso(),
    });
  }

  /** GET /forecast-records/:id */
  getById(id: number | string): Observable<ForecastRecord> {
    const idStr = String(id);

    if (!this.useMock) {
      return this.http.get<ForecastRecord>(`${this.baseUrl}/${encodeURIComponent(idStr)}`);
    }

    this.ensureSeeded();

    const existing = this.store.get(idStr);
    if (!existing) {
      const mock: ForecastRecord = {
        ...createEmptyForecastRecord(),
        id: Number.isFinite(Number(idStr)) ? Number(idStr) : undefined,
        status: 'Draft',
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

    return of(existing).pipe(delay(150));
  }

  /** POST /forecast-records */
  create(record: ForecastRecord): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.post<ForecastRecord>(this.baseUrl, record);
    }

    this.ensureSeeded();

    const id = Date.now();
    const now = this.nowIso();

    const created: ForecastRecord = {
      ...record,
      id,
      createdAt: record.createdAt ?? now,
      updatedAt: now,
      assignedToUserId: record.assignedToUserId ?? null,
      assignedToName: record.assignedToName ?? null,
      assignedAt: record.assignedAt ?? null,
      apfsNumber:
        record.apfsNumber ??
        `APFS-${Math.floor(Math.random() * 1000000)
          .toString()
          .padStart(6, '0')}`,
    };

    this.store.set(String(id), created);
    return of(created).pipe(delay(150));
  }

  /** PUT /forecast-records/:id */
  update(record: ForecastRecord): Observable<ForecastRecord> {
    if (!record.id) {
      return throwError(() => new Error('ForecastRecord.id is required for update'));
    }

    if (!this.useMock) {
      return this.http.put<ForecastRecord>(`${this.baseUrl}/${record.id}`, record);
    }

    this.ensureSeeded();

    const updated: ForecastRecord = { ...record, updatedAt: this.nowIso() };
    this.store.set(String(record.id), updated);
    return of(updated).pipe(delay(150));
  }

  /** POST /forecast-records/:id/submit */
  submit(id: number, submittedBy: string | null = null): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.post<ForecastRecord>(`${this.baseUrl}/${id}/submit`, { submittedBy });
    }

    this.ensureSeeded();

    const existing = this.store.get(String(id));
    if (!existing) return throwError(() => new Error(`ForecastRecord ${id} not found`));

    const submitted: ForecastRecord = {
      ...existing,
      status: 'Submitted',
      submittedAt: this.nowIso(),
      submittedBy,
      updatedAt: this.nowIso(),
    };

    this.store.set(String(id), submitted);
    return of(submitted).pipe(delay(150));
  }


  /** GET /forecast-records */
  list(query: ForecastRecordQuery = {}): Observable<ForecastRecord[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const assigned = query.assigned ?? 'all';
    const sort = query.sort ?? 'updatedAt:desc';
    const status = query.status ?? 'All';
    const q = query.q?.trim();

    // ---------- REAL API ----------
    if (!this.useMock) {
      let params = new HttpParams()
        .set('page', String(page))
        .set('pageSize', String(pageSize))
        .set('sort', sort);

      if (q) params = params.set('q', q);
      if (status && status !== 'All') params = params.set('status', status);
      if (assigned && assigned !== 'all') params = params.set('assigned', assigned);
      console.log('[ForecastRecordService.list] query=', query, 'url=', this.baseUrl);
      return this.http.get<ForecastRecord[]>(this.baseUrl, { params });
    }

    // ---------- MOCK MODE ----------
    this.ensureSeeded();

    let rows = Array.from(this.store.values());

    // Filter: status
    if (status !== 'All') {
      rows = rows.filter((r) => r.status === status);
    }

    // Filter: assigned
    if (assigned === 'claimed') {
      rows = rows.filter((r) => !!r.assignedToUserId);
    } else if (assigned === 'unclaimed') {
      rows = rows.filter((r) => !r.assignedToUserId);
    }

    // Filter: free text (apfsNumber + requirementsTitle)
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) =>
        `${r.apfsNumber ?? ''} ${r.requirementsTitle ?? ''}`.toLowerCase().includes(needle)
      );
    }

    // Sort
    const [field, dir] = sort.split(':') as ['updatedAt' | 'createdAt', 'asc' | 'desc'];
    rows.sort((a, b) => {
      const av = new Date((a as any)[field] ?? 0).getTime();
      const bv = new Date((b as any)[field] ?? 0).getTime();
      return dir === 'asc' ? av - bv : bv - av;
    });

    // Page (1-based)
    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);

    return of(rows).pipe(delay(150));
  }



  /** POST /forecast-records/:id/claim */
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

    const claimed: ForecastRecord = {
      ...existing,
      assignedToUserId: payload?.userId ?? 'mock-user',
      assignedToName: payload?.userName ?? 'Mock User',
      assignedAt: this.nowIso(),
      updatedAt: this.nowIso(),
    };

    this.store.set(String(id), claimed);
    return of(claimed).pipe(delay(150));
  }

  /** POST /forecast-records/:id/unclaim */
  unclaim(
    id: number,
    payload?: { userId?: string | null; force?: boolean }
  ): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.post<ForecastRecord>(`${this.baseUrl}/${id}/unclaim`, payload ?? {});
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

    const unclaimed: ForecastRecord = {
      ...existing,
      assignedToUserId: null,
      assignedToName: null,
      assignedAt: null,
      updatedAt: this.nowIso(),
    };

    this.store.set(String(id), unclaimed);
    return of(unclaimed).pipe(delay(150));
  }
}
