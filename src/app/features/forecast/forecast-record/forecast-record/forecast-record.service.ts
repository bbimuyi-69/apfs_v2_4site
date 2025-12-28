import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { ForecastRecord } from '../models/forecast-record.model';
import { createEmptyForecastRecord } from '../models/forecast-record.factory';

@Injectable({ providedIn: 'root' })
export class ForecastRecordService {
  private readonly http = inject(HttpClient);

  // Flip this to false when your API is ready
  private readonly useMock = true;

  // Your node route is /forecast-records (no /api)
  private readonly baseUrl = 'http://localhost:3000/forecast-records';

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

    // Seed a handful of rows so the dashboard has Queue + Claimed examples
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
        apfsNumber: `APFS-${String(id).slice(-6)}`,
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
  getById(id: string): Observable<ForecastRecord> {
    if (!this.useMock) {
      return this.http.get<ForecastRecord>(`${this.baseUrl}/${encodeURIComponent(id)}`);
    }

    this.ensureSeeded();

    const existing = this.store.get(id);
    if (!existing) {
      const mock: ForecastRecord = {
        ...createEmptyForecastRecord(),
        id: Number.isFinite(Number(id)) ? Number(id) : undefined,
        status: 'Draft',
        createdAt: this.nowIso(),
        updatedAt: this.nowIso(),
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,
        apfsNumber: `APFS-${id}`,
        requirementsTitle: `Mock Requirement ${id}`,
      };

      this.store.set(id, mock);
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

      // default to unclaimed on create
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
  list(): Observable<ForecastRecord[]> {
    if (!this.useMock) {
      return this.http.get<ForecastRecord[]>(this.baseUrl);
    }

    this.ensureSeeded();

    return of(Array.from(this.store.values())).pipe(delay(150));
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

    if (existing.assignedToUserId) {
      return throwError(() => new Error(`ForecastRecord ${id} already claimed`));
    }

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

    // Optional mock guard (mirrors server idea)
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
