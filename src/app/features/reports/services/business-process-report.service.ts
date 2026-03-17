import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type BusinessProcessSectionKey =
    | 'requirements'
    | 'contracting'
    | 'coordinator'
    | 'published';

export type BusinessProcessMetricKey =
    | 'approved'
    | 'rejected'
    | 'current'
    | 'touched';

export type BusinessProcessFilters = {
    components?: string[];
    requirementsOffices?: string[];
    contractingOffices?: string[];
    coordinatorOffices?: string[];
    fiscalYears?: Array<string | number>;
    startDate?: string;
    endDate?: string;
    creationDateAfter?: string;
    creationDateBefore?: string;
};

export type BusinessProcessSectionSummary = {
    label: string;
    totalApprovals: number;
    avgApprovalDisplay: string;
    totalRejections: number;
    avgRejectionDisplay: string;
    currentCount: number;
    touchedCount: number;
};

export type BusinessProcessSummary = {
    filtersApplied?: {
        components?: string[];
        requirementsOffices?: string[];
        contractingOffices?: string[];
        coordinatorOffices?: string[];
        fiscalYears?: Array<string | number>;
        startDate?: string;
        endDate?: string;
        creationDateAfter?: string;
        creationDateBefore?: string;
    };
    sections: Record<BusinessProcessSectionKey, BusinessProcessSectionSummary>;
};

export type BusinessProcessDetailRow = {
    recordId?: number;
    apfsNumber: string;
    component: string;
    requirementsOffice: string;
    contractingOffice: string;
    coordinatorOffice: string;
    requirementsTitle: string;
    workflowStatus: string;
    createdAt?: string;
    updatedAt?: string;
    enteredAt?: string;
    exitedAt?: string;
    elapsedDisplay?: string;
};

export type BusinessProcessDetailResponse = {
    filtersApplied?: {
        components?: string[];
        requirementsOffices?: string[];
        contractingOffices?: string[];
        coordinatorOffices?: string[];
        fiscalYears?: Array<string | number>;
        startDate?: string;
        endDate?: string;
        creationDateAfter?: string;
        creationDateBefore?: string;
    };
    section: BusinessProcessSectionKey;
    metric: BusinessProcessMetricKey;
    count: number;
    rows: BusinessProcessDetailRow[];
};

@Injectable({ providedIn: 'root' })
export class BusinessProcessReportService {
    private readonly apiBase = '/api';

    constructor(private http: HttpClient) { }

    getSummary$(filters: BusinessProcessFilters): Observable<BusinessProcessSummary> {
        const params = this.buildParams(filters);

        return this.http.get<BusinessProcessSummary>(
            `${this.apiBase}/forecast-records/business-process-report`,
            { params }
        );
    }

    getDetails$(
        filters: BusinessProcessFilters,
        section: BusinessProcessSectionKey,
        metric: BusinessProcessMetricKey
    ): Observable<BusinessProcessDetailResponse> {
        let params = this.buildParams(filters);
        params = params.set('section', section);
        params = params.set('metric', metric);

        return this.http.get<BusinessProcessDetailResponse>(
            `${this.apiBase}/forecast-records/business-process-report/details`,
            { params }
        );
    }

    private buildParams(filters: BusinessProcessFilters): HttpParams {
        let params = new HttpParams();

        if (filters.components?.length) {
            params = params.set('components', filters.components.join(','));
        }

        if (filters.requirementsOffices?.length) {
            params = params.set('requirementsOffices', filters.requirementsOffices.join(','));
        }

        if (filters.contractingOffices?.length) {
            params = params.set('contractingOffices', filters.contractingOffices.join(','));
        }

        if (filters.coordinatorOffices?.length) {
            params = params.set('coordinatorOffices', filters.coordinatorOffices.join(','));
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