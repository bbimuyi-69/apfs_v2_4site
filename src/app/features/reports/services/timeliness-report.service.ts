import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

const DEMO_MODE = false; // flip to false later

type ForecastRecord = {
    id: number | string;

    // prefilter fields
    component?: string | null;
    requirementsOffice?: string | null;
    fiscalYear?: string | number | null;

    // timeliness fields
    anticipatedAwardDate?: string | null; // "MM/DD/YYYY" (demo) or ISO-ish
    status?: string | null;              // "Published"
    updatedAt?: string | null;           // ISO string (assume last publish touch)
};

type RecordsResp = { rows: ForecastRecord[]; total: number };

type BucketKey =
    | 'MISSING_DATES'
    | 'PAST_DUE'
    | 'DUE_0_30'
    | 'DUE_31_60'
    | 'DUE_61_90'
    | 'DUE_91_180'
    | 'DUE_181_PLUS';

export type TimelinessFilters = {
    components?: string[];            // e.g. ["DHS HQ"]
    requirementsOffices?: string[];   // e.g. ["DHS HQ CPO"]
    fiscalYears?: Array<string | number>; // e.g. ["2026"] or [2026]
};

export type TimelinessListRow = {
    apfsNumber: string;               // id
    component: string;
    office: string;                   // requirementsOffice
    anticipatedAwardDate: string;      // raw MM/DD/YYYY
    publishedDate: string;            // ISO (updatedAt)
};

export type TimelinessSummary = {
    totalVisible: number;
    totalPublished: number;
    buckets: Record<BucketKey, { count: number; percentOfPublished: number }>;

    // ✅ new: list rows for the drawer
    rowsByBucket: Record<BucketKey, TimelinessListRow[]>;
};

@Injectable({ providedIn: 'root' })
export class TimelinessReportService {
    private readonly apiBase = '/api';

    constructor(private http: HttpClient) { }

    getTimelinessSummary$(filters: TimelinessFilters): Observable<TimelinessSummary> {
        // ✅ only need records now (no activity endpoint)
        const records$ = this.http.get<RecordsResp>(`${this.apiBase}/forecast-records`);



        return records$.pipe(
            map((r) => {
                let records = (r?.rows ?? []).map(normalizeForecastRecord);

                if (DEMO_MODE) {
                    records = addDemoRows(records);
                }

                records = applyPrefilters(records, filters);

                return summarizeTimeliness(records);
            })
        );
    }
}

/* -----------------------
   Helpers (outside class)
------------------------ */


function parseAwardDateToUtc(s?: string | null): Date | null {
    if (!s) return null;
    const trimmed = s.trim();
    if (!trimmed) return null;

    // MM/DD/YYYY
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const mm = Number(m[1]);
        const dd = Number(m[2]);
        const yyyy = Number(m[3]);
        const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
        if (Number.isNaN(dt.getTime())) return null;
        return dt;
    }

    // ISO-ish (YYYY-MM-DD or full ISO)
    const iso = new Date(trimmed);
    if (!Number.isNaN(iso.getTime())) {
        return new Date(Date.UTC(iso.getUTCFullYear(), iso.getUTCMonth(), iso.getUTCDate(), 0, 0, 0, 0));
    }

    return null;
}
function normalizeForecastRecord(raw: any): ForecastRecord {
    // Try common field names without forcing backend changes
    const status =
        raw?.status ??
        raw?.workflowStatus ??
        raw?.workflow_status ??
        raw?.workflow_status_name ??
        null;

    const updatedAt =
        raw?.updatedAt ??
        raw?.updated_at ??
        raw?.lastUpdatedAt ??
        raw?.last_updated_at ??
        raw?.modifiedAt ??
        raw?.modified_at ??
        raw?.createdAt ?? // last resort
        null;

    const component =
        raw?.component ??
        raw?.Component ??
        raw?.agencyComponent ??
        null;

    // requirements office name varies a lot in APFS clones—try a few
    const requirementsOffice =
        raw?.requirementsOffice ??
        raw?.requirements_office ??
        raw?.requirementsOfficeName ??
        raw?.requirementsOfficeLabel ??
        raw?.requirementsDivision ??
        raw?.requirementsOrg ??
        raw?.requirements_org ??
        null;

    const fiscalYear =
        raw?.fiscalYear ??
        raw?.fiscal_year ??
        raw?.FY ??
        null;

    const anticipatedAwardDate =
        raw?.anticipatedAwardDate ??
        raw?.anticipated_award_date ??
        raw?.anticipatedAward ??
        raw?.anticipated_award ??
        null;

    return {
        id: raw?.id,
        component,
        requirementsOffice,
        fiscalYear,
        anticipatedAwardDate,
        status,
        updatedAt,
    };
}

function norm(s: unknown): string {
    return String(s ?? '').trim();
}

function isPublished(r: ForecastRecord): boolean {
    return norm(r.status).toUpperCase() === 'PUBLISHED';
}

function matchesFilter(value: string, allowed?: string[]): boolean {
    if (!allowed || allowed.length === 0) return true;
    const v = value.trim();
    return allowed.some((a) => a.trim() === v);
}

function matchesFy(value: string, allowed?: Array<string | number>): boolean {
    if (!allowed || allowed.length === 0) return true;
    const v = value.trim();
    return allowed.some((a) => String(a).trim() === v);
}

function applyPrefilters(records: ForecastRecord[], f: TimelinessFilters): ForecastRecord[] {
    let out = [...records];

    if (f.components?.length) {
        out = out.filter((r) => matchesFilter(norm(r.component), f.components));
    }

    if (f.requirementsOffices?.length) {
        out = out.filter((r) => matchesFilter(norm(r.requirementsOffice), f.requirementsOffices));
    }

    if (f.fiscalYears?.length) {
        out = out.filter((r) => matchesFy(norm(r.fiscalYear), f.fiscalYears));
    }

    return out;
}

function parseMmddyyyyToUtc(s?: string | null): Date | null {
    if (!s) return null;
    const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;

    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    if (!mm || !dd || !yyyy) return null;

    const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
    if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
    return dt;
}

function parseIsoToUtcDateOnly(iso?: string | null): Date | null {
    if (!iso) return null;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;

    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 0, 0, 0, 0));
}

function diffDaysUtc(a: Date, b: Date): number {
    // returns (a - b) in days, using date-only UTC
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((a.getTime() - b.getTime()) / msPerDay);
}

function bucketFor(daysToAward: number | null): BucketKey {
    if (daysToAward === null) return 'MISSING_DATES';
    if (daysToAward < 0) return 'PAST_DUE';
    if (daysToAward <= 30) return 'DUE_0_30';
    if (daysToAward <= 60) return 'DUE_31_60';
    if (daysToAward <= 90) return 'DUE_61_90';
    if (daysToAward <= 180) return 'DUE_91_180';
    return 'DUE_181_PLUS';
}

export function summarizeTimeliness(records: ForecastRecord[]): TimelinessSummary {
    const counts: Record<BucketKey, number> = {
        MISSING_DATES: 0,
        PAST_DUE: 0,
        DUE_0_30: 0,
        DUE_31_60: 0,
        DUE_61_90: 0,
        DUE_91_180: 0,
        DUE_181_PLUS: 0,
    };

    const rowsByBucket: Record<BucketKey, TimelinessListRow[]> = {
        MISSING_DATES: [],
        PAST_DUE: [],
        DUE_0_30: [],
        DUE_31_60: [],
        DUE_61_90: [],
        DUE_91_180: [],
        DUE_181_PLUS: [],
    };

    const totalVisible = records.length;
    const published = records.filter(isPublished);
    const totalPublished = published.length;

    for (const r of published) {
        //const award = parseMmddyyyyToUtc(r.anticipatedAwardDate);
        const award = parseAwardDateToUtc(r.anticipatedAwardDate);
        const publishedAt = parseIsoToUtcDateOnly(r.updatedAt);

        let bucket: BucketKey;

        if (!award || !publishedAt) {
            bucket = 'MISSING_DATES';
        } else {
            const daysToAward = diffDaysUtc(award, publishedAt); // award - publishedAt
            bucket = bucketFor(daysToAward);
        }

        counts[bucket]++;

        // ✅ minimal list fields (you can add title later if you want)
        rowsByBucket[bucket].push({
            apfsNumber: String(r.id ?? ''),
            component: norm(r.component),
            office: norm(r.requirementsOffice),
            anticipatedAwardDate: norm(r.anticipatedAwardDate),
            publishedDate: norm(r.updatedAt),
        });
    }

    const denom = totalPublished || 1;

    return {
        totalVisible,
        totalPublished,
        buckets: {
            MISSING_DATES: { count: counts.MISSING_DATES, percentOfPublished: +((counts.MISSING_DATES * 100) / denom).toFixed(1) },
            PAST_DUE: { count: counts.PAST_DUE, percentOfPublished: +((counts.PAST_DUE * 100) / denom).toFixed(1) },
            DUE_0_30: { count: counts.DUE_0_30, percentOfPublished: +((counts.DUE_0_30 * 100) / denom).toFixed(1) },
            DUE_31_60: { count: counts.DUE_31_60, percentOfPublished: +((counts.DUE_31_60 * 100) / denom).toFixed(1) },
            DUE_61_90: { count: counts.DUE_61_90, percentOfPublished: +((counts.DUE_61_90 * 100) / denom).toFixed(1) },
            DUE_91_180: { count: counts.DUE_91_180, percentOfPublished: +((counts.DUE_91_180 * 100) / denom).toFixed(1) },
            DUE_181_PLUS: { count: counts.DUE_181_PLUS, percentOfPublished: +((counts.DUE_181_PLUS * 100) / denom).toFixed(1) },
        },
        rowsByBucket,
    };
}

function addDemoRows(records: ForecastRecord[]): ForecastRecord[] {
    const baseId = Date.now();

    // Demo records include the requested prefilter fields
    const demo: ForecastRecord[] = [
        {
            id: baseId + 1,
            component: 'DHS HQ',
            requirementsOffice: 'DHS HQ CPO',
            fiscalYear: '2026',
            status: 'Published',
            anticipatedAwardDate: '03/10/2026',
            updatedAt: '2026-03-01T12:00:00.000Z', // 9 days lead -> DUE_0_30
        },
        {
            id: baseId + 2,
            component: 'DHS HQ',
            requirementsOffice: 'DHS HQ CPO',
            fiscalYear: '2026',
            status: 'Published',
            anticipatedAwardDate: '03/01/2026',
            updatedAt: '2026-03-11T12:00:00.000Z', // late -> PAST_DUE
        },
        {
            id: baseId + 3,
            component: 'DHS HQ',
            requirementsOffice: 'DHS HQ CPO',
            fiscalYear: '2026',
            status: 'Published',
            anticipatedAwardDate: '01/01/2026',
            updatedAt: '2026-02-15T12:00:00.000Z', // late -> PAST_DUE
        },
        {
            id: baseId + 4,
            component: 'DHS HQ',
            requirementsOffice: 'DHS HQ CPO',
            fiscalYear: '2025',
            status: 'Published',
            anticipatedAwardDate: '12/15/2025',
            updatedAt: '2026-02-28T12:00:00.000Z', // late -> PAST_DUE
        },
        {
            id: baseId + 5,
            component: 'CBP',
            requirementsOffice: 'CBP Office of Acquisition',
            fiscalYear: '2025',
            status: 'Published',
            anticipatedAwardDate: '11/01/2025',
            updatedAt: '2026-03-01T12:00:00.000Z', // late -> PAST_DUE
        },
        {
            id: baseId + 6,
            component: 'DHS HQ',
            requirementsOffice: 'DHS HQ CPO',
            fiscalYear: '2026',
            status: 'Published',
            anticipatedAwardDate: null,
            updatedAt: '2026-03-01T12:00:00.000Z', // missing award -> MISSING_DATES
        },
        {
            id: baseId + 7,
            component: 'DHS HQ',
            requirementsOffice: 'DHS HQ CPO',
            fiscalYear: '2026',
            status: 'Draft',
            anticipatedAwardDate: '04/01/2026',
            updatedAt: '2026-03-01T12:00:00.000Z', // ignored (not Published)
        },
    ];

    return [...records, ...demo];
}