import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export type ReportCriteria = {
    component?: string[];
    office?: string[];
    anticipatedAwardStart?: string | null;
    anticipatedAwardEnd?: string | null;
    createdAfter?: string | null;
    createdBefore?: string | null;
    publishedOnly?: boolean;
};

export type AnticipatedAwardsRow = {
    component: string;
    under250k: number;
    k250To500: number;
    k500To1m: number;
    m1To2: number;
    m2To5: number;
    m5To10: number;
    m10To20: number;
    m20To50: number;
    m50To100: number;
    over100m: number;
    total: number;
};

export type AnticipatedAwardsResult = {
    rows: AnticipatedAwardsRow[];
    allRecords: any[];
};

@Injectable({ providedIn: 'root' })
export class AnticipatedAwardsReportService {
    private http = inject(HttpClient);
    private baseUrl = '/api/forecast-records/report-base';

    getReport(criteria: ReportCriteria): Observable<AnticipatedAwardsResult> {
        let params = new HttpParams();

        if (criteria.component?.length) {
            params = params.set('component', criteria.component.join(','));
        }

        if (criteria.office?.length) {
            params = params.set('office', criteria.office.join(','));
        }

        if (criteria.anticipatedAwardStart) {
            params = params.set('anticipatedAwardStart', criteria.anticipatedAwardStart);
        }

        if (criteria.anticipatedAwardEnd) {
            params = params.set('anticipatedAwardEnd', criteria.anticipatedAwardEnd);
        }

        if (criteria.createdAfter) {
            params = params.set('createdAfter', criteria.createdAfter);
        }

        if (criteria.createdBefore) {
            params = params.set('createdBefore', criteria.createdBefore);
        }

        if (criteria.publishedOnly !== undefined) {
            params = params.set('publishedOnly', String(criteria.publishedOnly));
        }

        return this.http.get<{ rows: any[]; total: number }>(this.baseUrl, { params }).pipe(
            map(res => {
                const records = res.rows ?? [];
                const grouped = new Map<string, AnticipatedAwardsRow>();

                const getComponent = (r: any) =>
                    r.component || r.organization || 'Unknown';

                const normalizeRange = (range: string | null | undefined): string => {
                    return String(range ?? '')
                        .trim()
                        .toUpperCase()
                        .replace(/\s+/g, ' ')
                        .replace(/\$/g, '');
                };

                const getDollarBucket = (
                    range: string | null | undefined
                ): keyof Omit<AnticipatedAwardsRow, 'component' | 'total'> | null => {
                    const r = normalizeRange(range);
                    if (!r) return null;

                    // -----------------------------
                    // Under $250K
                    // -----------------------------
                    if (
                        r === '0 - 250K' ||
                        r === '0_250K' ||
                        r === 'UNDER 250K' ||
                        r === 'UNDER_250K'
                    ) {
                        return 'under250k';
                    }

                    // -----------------------------
                    // $250K to $500K
                    // -----------------------------
                    if (
                        r === '250K - 500K' ||
                        r === '250K_500K' ||
                        r === '350K - 499K'
                    ) {
                        return 'k250To500';
                    }

                    // -----------------------------
                    // $500K to $1M
                    // -----------------------------
                    if (
                        r === '500K - 1M' ||
                        r === '500K_1M' ||
                        r === '500K - 999K'
                    ) {
                        return 'k500To1m';
                    }

                    // -----------------------------
                    // Legacy combined bucket:
                    // $250K - $1M
                    // Put into $500K-$1M for now
                    // -----------------------------
                    if (r === '250K - 1M' || r === '250K_1M') {
                        return 'k500To1m';
                    }

                    // -----------------------------
                    // $1M to $2M
                    // -----------------------------
                    if (
                        r === '1M - 2M' ||
                        r === '1M_2M' ||
                        r === '1M - 1.9M'
                    ) {
                        return 'm1To2';
                    }

                    // -----------------------------
                    // $2M to $5M
                    // -----------------------------
                    if (
                        r === '2M - 5M' ||
                        r === '2M_5M' ||
                        r === '2M - 4.9M'
                    ) {
                        return 'm2To5';
                    }

                    // -----------------------------
                    // Legacy combined bucket:
                    // $1M - $5M
                    // Put into $2M-$5M for now
                    // -----------------------------
                    if (r === '1M - 5M' || r === '1M_5M') {
                        return 'm2To5';
                    }

                    // -----------------------------
                    // $5M to $10M
                    // -----------------------------
                    if (
                        r === '5M - 10M' ||
                        r === '5M_10M' ||
                        r === '5M - 9.9M'
                    ) {
                        return 'm5To10';
                    }

                    // -----------------------------
                    // $10M to $20M
                    // -----------------------------
                    if (
                        r === '10M - 20M' ||
                        r === '10M_20M' ||
                        r === '10M - 19M'
                    ) {
                        return 'm10To20';
                    }

                    // -----------------------------
                    // $20M to $50M
                    // -----------------------------
                    if (
                        r === '20M - 50M' ||
                        r === '20M_50M' ||
                        r === '20M - 49M'
                    ) {
                        return 'm20To50';
                    }

                    // -----------------------------
                    // $50M to $100M
                    // -----------------------------
                    if (
                        r === '50M - 100M' ||
                        r === '50M_100M' ||
                        r === '50M - 99M'
                    ) {
                        return 'm50To100';
                    }

                    // -----------------------------
                    // Over $100M
                    // -----------------------------
                    if (
                        r === '100M+' ||
                        r === '10M+' ||
                        r === 'OVER 100M' ||
                        r === 'OVER_100M' ||
                        r === '100M - 249M' ||
                        r === '250M - 499M' ||
                        r === '500M - 999M' ||
                        r === '1B - 1.9B' ||
                        r === '2B - 2.9B' ||
                        r === '3B - 3.9B' ||
                        r === '4B - 4.9B'
                    ) {
                        return 'over100m';
                    }

                    return null;
                };

                const createRow = (component: string): AnticipatedAwardsRow => ({
                    component,
                    under250k: 0,
                    k250To500: 0,
                    k500To1m: 0,
                    m1To2: 0,
                    m2To5: 0,
                    m5To10: 0,
                    m10To20: 0,
                    m20To50: 0,
                    m50To100: 0,
                    over100m: 0,
                    total: 0
                });

                for (const record of records) {
                    const component = getComponent(record);

                    if (!grouped.has(component)) {
                        grouped.set(component, createRow(component));
                    }

                    const row = grouped.get(component)!;
                    const bucket = getDollarBucket(record.dollarRange);

                    if (bucket) {
                        row[bucket] += 1;
                        row.total += 1;
                    }
                }

                const rows = Array.from(grouped.values());
                const totalRow = createRow('TOTAL');

                for (const row of rows) {
                    totalRow.under250k += row.under250k;
                    totalRow.k250To500 += row.k250To500;
                    totalRow.k500To1m += row.k500To1m;
                    totalRow.m1To2 += row.m1To2;
                    totalRow.m2To5 += row.m2To5;
                    totalRow.m5To10 += row.m5To10;
                    totalRow.m10To20 += row.m10To20;
                    totalRow.m20To50 += row.m20To50;
                    totalRow.m50To100 += row.m50To100;
                    totalRow.over100m += row.over100m;
                    totalRow.total += row.total;
                }

                return {
                    rows: [totalRow, ...rows],
                    allRecords: records
                };
            })
        );
    }
}