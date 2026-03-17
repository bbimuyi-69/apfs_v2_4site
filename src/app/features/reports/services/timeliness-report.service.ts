import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type BucketKey =
    | 'MISSING_DATES'
    | 'PAST_DUE'
    | 'DUE_0_30'
    | 'DUE_31_60'
    | 'DUE_61_90'
    | 'DUE_91_180'
    | 'DUE_181_PLUS';

export type TimelinessFilters = {
    components?: string[];
    requirementsOffices?: string[];
    fiscalYears?: Array<string | number>;
    startDate?: string;
    endDate?: string;
    creationDateAfter?: string;
    creationDateBefore?: string;
};

export type TimelinessListRow = {
    apfsNumber: string;
    recordId?: number;
    component: string;
    office: string;
    anticipatedAwardDate: string;
    publishedDate: string;
    createdAt?: string;
    updatedAt?: string;
    workflowStatus?: string;
};

export type TimelinessBucketSummary = {
    count: number;
    percentOfPublished: number;
};

export type TimelinessSummary = {
    filtersApplied?: {
        components?: string[];
        requirementsOffices?: string[];
        fiscalYears?: Array<string | number>;
        startDate?: string;
        endDate?: string;
        creationDateAfter?: string;
        creationDateBefore?: string;
    };
    totalVisible: number;
    totalPublished: number;
    buckets: Record<BucketKey, TimelinessBucketSummary>;
    rowsByBucket: Record<BucketKey, TimelinessListRow[]>;
};

@Injectable({ providedIn: 'root' })
export class TimelinessReportService {
    private readonly apiBase = '/api';

    constructor(private http: HttpClient) { }

    getTimelinessSummary$(filters: TimelinessFilters): Observable<TimelinessSummary> {
        const params = this.buildParams(filters);

        return this.http.get<TimelinessSummary>(
            `${this.apiBase}/forecast-records/timeliness-report`,
            { params }
        );
    }

    private buildParams(filters: TimelinessFilters): HttpParams {
        let params = new HttpParams();

        if (filters.components?.length) {
            params = params.set('components', filters.components.join(','));
        }

        if (filters.requirementsOffices?.length) {
            params = params.set('requirementsOffices', filters.requirementsOffices.join(','));
        }

        if (filters.fiscalYears?.length) {
            params = params.set(
                'fiscalYears',
                filters.fiscalYears.map(v => String(v)).join(',')
            );
        }

        if (filters.startDate) {
            params = params.set('startDate', filters.startDate);
        }

        if (filters.endDate) {
            params = params.set('endDate', filters.endDate);
        }

        if (filters.creationDateAfter) {
            params = params.set('creationDateAfter', filters.creationDateAfter);
        }

        if (filters.creationDateBefore) {
            params = params.set('creationDateBefore', filters.creationDateBefore);
        }

        return params;
    }
}