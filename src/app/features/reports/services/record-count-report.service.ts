import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';

export type RecordCountStatus =
    | 'new'
    | 'reCompete'
    | 'all';

export type RecordCountCriteria = {
    status?: RecordCountStatus;
    component?: string[];
    office?: string[];
    startDate?: string | null;
    endDate?: string | null;
    createdAfter?: string | null;
    createdBefore?: string | null;
};

export type RecordCountRow = {
    id: number | string;
    apfsNumber: string;
    component: string;
    dollarRange: string;
    requirementsTitle: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    workflowStatus?: string | null;
    history?: any[];
};

export type RecordCountResult = {
    total: number;
    rows: RecordCountRow[];
    allRecords: any[];
};

@Injectable({ providedIn: 'root' })
export class RecordCountReportService {
    private http = inject(HttpClient);
    private baseUrl = '/api/forecast-records';

    getReport(criteria: RecordCountCriteria): Observable<RecordCountResult> {
        let params = new HttpParams();

        if (criteria.component?.length) {
            params = params.set('component', criteria.component.join(','));
        }

        if (criteria.office?.length) {
            params = params.set('office', criteria.office.join(','));
        }

        if (criteria.createdAfter) {
            params = params.set('createdAfter', criteria.createdAfter);
        }

        if (criteria.createdBefore) {
            params = params.set('createdBefore', criteria.createdBefore);
        }

        console.log('record-count params', params.toString());

        return this.http.get<{ rows: any[]; total: number }>(this.baseUrl, { params }).pipe(
            tap(res => console.log('record-count raw backend response', res)),
            map(res => {


                const baseRows = Array.isArray(res?.rows) ? res.rows : [];
                const filtered = this.applyClientFilters(baseRows, criteria);

                const rows: RecordCountRow[] = filtered.map((r: any) => ({
                    id: r.id,
                    apfsNumber: r.apfsNumber ?? r.apfs_number ?? '',
                    component: r.component ?? r.organization ?? '',
                    dollarRange: r.dollarRange ?? '',
                    requirementsTitle: r.requirementsTitle ?? '',
                    createdAt: r.createdAt ?? null,
                    updatedAt: r.updatedAt ?? null,
                    workflowStatus: r.workflowStatus ?? r.status ?? null,
                    history: Array.isArray(r.history) ? r.history : []
                }));

                return {
                    total: rows.length,
                    rows,
                    allRecords: filtered
                };
            })
        );
    }

    private applyClientFilters(records: any[], criteria: RecordCountCriteria): any[] {
        const componentFilters = (criteria.component ?? [])
            .map((x: string) => x.trim().toUpperCase())
            .filter(Boolean);

        const officeFilters = (criteria.office ?? [])
            .map((x: string) => x.trim().toUpperCase())
            .filter(Boolean);

        const start = this.parseDateOnly(criteria.startDate);
        const end = this.parseDateOnly(criteria.endDate, true);
        const createdAfter = this.parseDateOnly(criteria.createdAfter);
        const createdBefore = this.parseDateOnly(criteria.createdBefore, true);

        return records.filter((record: any) => {
            const component = String(record?.component ?? record?.organization ?? '')
                .trim()
                .toUpperCase();

            const offices = [
                record?.office,
                record?.requirementsOffice,
                record?.contractingOffice,
                record?.coordinatorOffice
            ]
                .map((x: unknown) => String(x ?? '').trim().toUpperCase())
                .filter(Boolean);

            const created = this.parseDateTime(record?.createdAt);

            if (componentFilters.length) {
                const matchesComponent = componentFilters.some((f: string) => component.includes(f));
                if (!matchesComponent) {
                    return false;
                }
            }

            if (officeFilters.length) {
                const matchesOffice = officeFilters.some((f: string) =>
                    offices.some((o: string) => o.includes(f))
                );
                if (!matchesOffice) {
                    return false;
                }
            }

            if (createdAfter) {
                if (!created || created < createdAfter) {
                    return false;
                }
            }

            if (createdBefore) {
                if (!created || created > createdBefore) {
                    return false;
                }
            }

            if (!this.matchesStatus(record, criteria.status ?? 'all', start, end)) {
                return false;
            }

            return true;
        });
    }

    private matchesStatus(
        record: any,
        status: RecordCountStatus,
        start: Date | null,
        end: Date | null
    ): boolean {
        const contractStatus = String(record?.contractStatus ?? '')
            .trim()
            .toUpperCase();

        const normalizedStatus = String(status ?? '')
            .trim()
            .toUpperCase();

        if (normalizedStatus === 'ALL') {
            return this.matchesWorkedWindow(record, start, end);
        }

        if (normalizedStatus === 'NEW') {
            return contractStatus === 'NEW' && this.matchesWorkedWindow(record, start, end);
        }

        if (normalizedStatus === 'RECOMPETE' || normalizedStatus === 'RE-COMPETE') {
            return (
                (contractStatus === 'RE-COMPETE' || contractStatus === 'RECOMPETE') &&
                this.matchesWorkedWindow(record, start, end)
            );
        }

        return true;
    }

    private matchesCreatedWindow(record: any, start: Date | null, end: Date | null): boolean {
        const created = this.parseDateTime(record?.createdAt);
        if (!created) return false;
        return this.inRange(created, start, end);
    }

    private matchesWorkedWindow(record: any, start: Date | null, end: Date | null): boolean {
        const history = Array.isArray(record?.history) ? record.history : [];

        if (!start && !end) {
            return true;
        }

        if (!history.length) {
            const updated = this.parseDateTime(record?.updatedAt) ?? this.parseDateTime(record?.createdAt);
            return updated ? this.inRange(updated, start, end) : false;
        }

        return history.some((h: any) => {
            const d = this.parseDateTime(h?.time);
            return d ? this.inRange(d, start, end) : false;
        });
    }

    private matchesStateWindow(
        record: any,
        stateId: number,
        start: Date | null,
        end: Date | null
    ): boolean {
        const history = Array.isArray(record?.history) ? record.history : [];

        if (!history.length) {
            return false;
        }

        return history.some((h: any) => {
            const d = this.parseDateTime(h?.time);
            if (!d || !this.inRange(d, start, end)) return false;

            return (
                Number(h?.new_state_id) === stateId ||
                Number(h?.previous_state_id) === stateId
            );
        });
    }

    private inRange(value: Date, start: Date | null, end: Date | null): boolean {
        if (start && value < start) return false;
        if (end && value > end) return false;
        return true;
    }

    private parseDateOnly(value?: string | null, endOfDay = false): Date | null {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;

        if (endOfDay) {
            d.setHours(23, 59, 59, 999);
        } else {
            d.setHours(0, 0, 0, 0);
        }

        return d;
    }

    private parseDateTime(value?: string | null): Date | null {
        if (!value) return null;
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
}