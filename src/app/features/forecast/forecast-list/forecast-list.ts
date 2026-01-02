import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import {
  ForecastRecordService,
  ForecastRecordQuery,
} from '../forecast-record/services/forecast-record.service';
import { ForecastRecord } from '../forecast-record/models/forecast-record.model';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: T };

@Component({
  selector: 'app-forecast-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './forecast-list.html',
  styleUrls: ['./forecast-list.css'],
})
export class ForecastListComponent {
  private readonly service = inject(ForecastRecordService);
  private readonly reload$ = new Subject<void>();

  @Output() rowSelect = new EventEmitter<ForecastRecord>();

  // Mutable query state
  query: ForecastRecordQuery = {
    page: 1,
    pageSize: 25,
    status: 'All',
    assigned: 'all',
    sort: 'updatedAt:desc',
  };

  state$: Observable<LoadState<ForecastRecord[]>> = this.reload$.pipe(
    startWith(void 0),
    switchMap(() =>
      this.service.list(this.query).pipe(
        map((rows) => ({ status: 'ready', data: rows } as LoadState<ForecastRecord[]>)),
        startWith({ status: 'loading' } as LoadState<ForecastRecord[]>),
        catchError((err) =>
          of({
            status: 'error',
            error:
              err?.error?.message ||
              err?.message ||
              'Failed to load forecast records',
          } as LoadState<ForecastRecord[]>)
        )
      )
    )
  );

  refresh(): void {
    this.reload$.next();
  }

  select(r: ForecastRecord): void {
    this.rowSelect.emit(r);
  }

  setSearch(q: string): void {
    const nextQ = q?.trim() || undefined;

    this.query = {
      ...this.query,
      q: nextQ,
      page: 1,
    };
    this.refresh();
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.query = { ...this.query, page };
    this.refresh();
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setStatus(value);
  }

  onAssignedChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setAssigned(value);
  }

  setStatus(value: string): void {
    // ForecastRecordQuery uses `status?: string | 'All'`, so this is valid without `any`
    const nextStatus: ForecastRecordQuery['status'] = (value || 'All') as ForecastRecordQuery['status'];

    this.query = {
      ...this.query,
      status: nextStatus,
      page: 1,
    };
    this.refresh();
  }

  setAssigned(value: string): void {
    if (value === 'claimed' || value === 'unclaimed' || value === 'all') {
      const nextAssigned: ForecastRecordQuery['assigned'] = value;

      this.query = {
        ...this.query,
        assigned: nextAssigned,
        page: 1,
      };
      this.refresh();
    }
  }
}
