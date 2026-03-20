import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

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

type ReportBaseResponse = {
    rows: any[];
    total: number;
};

@Injectable({ providedIn: 'root' })
export class TimelinessReportService {
    private readonly apiBase = '/api/forecast-records/report-base';

    private readonly bucketOrder: BucketKey[] = [
        'MISSING_DATES',
        'PAST_DUE',
        'DUE_0_30',
        'DUE_31_60',
        'DUE_61_90',
        'DUE_91_180',
        'DUE_181_PLUS'
    ];

    constructor(private http: HttpClient) { }

    getTimelinessSummary$(filters: TimelinessFilters): Observable<TimelinessSummary> {
        const params = this.buildParams(filters);

        return this.http.get<ReportBaseResponse>(this.apiBase, { params }).pipe(
            map(res => {
                const visibleRows = Array.isArray(res?.rows) ? res.rows : [];
                const publishedRows = visibleRows.filter(r =>
                    String(r?.workflowStatus ?? '').toLowerCase() === 'published'
                );

                const rowsByBucket: Record<BucketKey, TimelinessListRow[]> = {
                    MISSING_DATES: [],
                    PAST_DUE: [],
                    DUE_0_30: [],
                    DUE_31_60: [],
                    DUE_61_90: [],
                    DUE_91_180: [],
                    DUE_181_PLUS: []
                };

                for (const record of publishedRows) {
                    const bucket = this.getBucketKey(record);
                    rowsByBucket[bucket].push(this.toListRow(record));
                }

                for (const key of this.bucketOrder) {
                    rowsByBucket[key] = rowsByBucket[key].sort((a, b) => {
                        const aDate = this.safeTime(a.anticipatedAwardDate);
                        const bDate = this.safeTime(b.anticipatedAwardDate);
                        return aDate - bDate;
                    });
                }

                const totalPublished = publishedRows.length;

                const buckets = this.bucketOrder.reduce((acc, key) => {
                    const count = rowsByBucket[key].length;
                    acc[key] = {
                        count,
                        percentOfPublished: this.toPercent(count, totalPublished)
                    };
                    return acc;
                }, {} as Record<BucketKey, TimelinessBucketSummary>);

                return {
                    filtersApplied: {
                        components: filters.components ?? [],
                        requirementsOffices: filters.requirementsOffices ?? [],
                        fiscalYears: filters.fiscalYears ?? [],
                        startDate: filters.startDate ?? '',
                        endDate: filters.endDate ?? '',
                        creationDateAfter: filters.creationDateAfter ?? '',
                        creationDateBefore: filters.creationDateBefore ?? ''
                    },
                    totalVisible: visibleRows.length,
                    totalPublished,
                    buckets,
                    rowsByBucket
                };
            })
        );
    }

    private buildParams(filters: TimelinessFilters): HttpParams {
        let params = new HttpParams();

        if (filters.components?.length) {
            params = params.set('component', filters.components.join(','));
        }

        if (filters.requirementsOffices?.length) {
            params = params.set('office', filters.requirementsOffices.join(','));
        }

        if (filters.startDate) {
            params = params.set('anticipatedAwardStart', filters.startDate);
        }

        if (filters.endDate) {
            params = params.set('anticipatedAwardEnd', filters.endDate);
        }

        if (filters.creationDateAfter) {
            params = params.set('createdAfter', filters.creationDateAfter);
        }

        if (filters.creationDateBefore) {
            params = params.set('createdBefore', filters.creationDateBefore);
        }

        params = params.set('reportScope', 'published');

        return params;
    }

    private getBucketKey(record: any): BucketKey {
        const awardRaw =
            record?.anticipatedAwardDate ??
            record?.anticipated_award_date ??
            record?.estimatedAwardDate ??
            record?.awardDate ??
            null;

        const publishedRaw =
            record?.publishedDate ??
            record?.published_date ??
            record?.datePublished ??
            record?.publishedAt ??
            record?.updatedAt ??
            record?.updated_at ??
            null;

        const awardDate = this.parseDate(awardRaw);
        const publishedDate = this.parseDate(publishedRaw);

        if (!awardDate || !publishedDate) {
            return 'MISSING_DATES';
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const diffDays = Math.floor(
            (awardDate.getTime() - publishedDate.getTime()) / msPerDay
        );

        if (diffDays < 0) return 'PAST_DUE';
        if (diffDays <= 30) return 'DUE_0_30';
        if (diffDays <= 60) return 'DUE_31_60';
        if (diffDays <= 90) return 'DUE_61_90';
        if (diffDays <= 180) return 'DUE_91_180';
        return 'DUE_181_PLUS';
    }

    private toListRow(record: any): TimelinessListRow {
        const requirementsOffice = this.asText(record?.requirementsOffice);
        const contractingOffice = this.asText(record?.contractingOffice);
        const coordinatorOffice = this.asText(record?.coordinatorOffice);
        const office = this.joinDistinct([
            this.asText(record?.office),
            requirementsOffice,
            contractingOffice,
            coordinatorOffice
        ]);

        const anticipatedAwardDate = this.formatDate(
            record?.anticipatedAwardDate ??
            record?.anticipated_award_date ??
            record?.estimatedAwardDate ??
            record?.awardDate
        );

        const publishedDate = this.formatDate(
            record?.publishedDate ??
            record?.published_date ??
            record?.datePublished ??
            record?.publishedAt ??
            record?.updatedAt ??
            record?.updated_at
        );

        return {
            apfsNumber:
                this.asText(record?.apfsNumber) ||
                this.asText(record?.fourSiteNumber) ||
                this.asText(record?.forecastNumber) ||
                this.asText(record?.id) ||
                '',
            recordId: this.toNumber(record?.id),
            component:
                this.asText(record?.component) ||
                this.asText(record?.organization) ||
                '',
            office,
            anticipatedAwardDate,
            publishedDate,
            createdAt: this.formatDateTime(record?.createdAt ?? record?.created_at),
            updatedAt: this.formatDateTime(record?.updatedAt ?? record?.updated_at),
            workflowStatus: this.asText(record?.workflowStatus)
        };
    }

    private parseDate(value: unknown): Date | null {
        if (!value) return null;
        const d = new Date(String(value));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    private formatDate(value: unknown): string {
        const d = this.parseDate(value);
        if (!d) return '';

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    private formatDateTime(value: unknown): string | undefined {
        const d = this.parseDate(value);
        if (!d) return undefined;
        return d.toISOString();
    }

    private toPercent(count: number, total: number): number {
        if (!total) return 0;
        return Math.round((count / total) * 100);
    }

    private safeTime(value: string): number {
        const d = this.parseDate(value);
        return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
    }

    private asText(value: unknown): string {
        return String(value ?? '').trim();
    }

    private toNumber(value: unknown): number | undefined {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }

    private joinDistinct(values: string[]): string {
        const unique = values.filter((v, i, arr) => !!v && arr.indexOf(v) === i);
        return unique.join(' | ');
    }
}