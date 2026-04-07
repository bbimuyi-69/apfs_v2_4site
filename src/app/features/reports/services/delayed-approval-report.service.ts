import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DelayedApprovalFilters {
    components: string[];
    statuses: string[];
    fiscalYears: string[];
    daysDelayed: number;
    creationDateAfter: string;
    creationDateBefore: string;
}

export interface DelayedApprovalRow {
    recordId: number | string;
    apfsNumber: string;
    component: string;
    creationDate: string;
    status: string;
    daysAwaitingApproval: number;
    assignedOffice: string;
    requirementsTitle: string;
    enteredCurrentLaneAt?: string;
}

export interface DelayedApprovalSummary {
    total: number;
    rows: DelayedApprovalRow[];
    minDays?: number;
    filtersApplied?: unknown;
}

@Injectable({ providedIn: 'root' })
export class DelayedApprovalReportService {
    // ✅ changed to report-base
    private readonly baseUrl = '/api/forecast-records/report-base';

    constructor(private http: HttpClient) { }

    getDelayedApprovalSummary$(filters: DelayedApprovalFilters): Observable<DelayedApprovalSummary> {
        let params = new HttpParams()
            // ✅ tells backend to use the new safe delayed-approval branch
            .set('reportScope', 'delayedApproval')
            .set('daysDelayed', String(filters.daysDelayed ?? 10));

        if (filters.components?.length) {
            params = params.set('components', filters.components.join(','));
        }

        if (filters.fiscalYears?.length) {
            params = params.set('fiscalYears', filters.fiscalYears.join(','));
        }

        if (filters.creationDateAfter) {
            params = params.set('creationDateAfter', filters.creationDateAfter);
        }

        if (filters.creationDateBefore) {
            params = params.set('creationDateBefore', filters.creationDateBefore);
        }

        // NOTE:
        // statuses is currently not used by filterReportRows/report-base delayedApproval branch.
        // Leave this out unless you add backend support for status filtering there.

        return this.http.get<DelayedApprovalSummary>(this.baseUrl, { params });
    }
}