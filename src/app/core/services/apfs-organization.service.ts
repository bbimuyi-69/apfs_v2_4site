import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ApfsOrganizationNode {
    id: number;
    name: string;
    acronym: string;
    full_name: string;
    active: 0 | 1;
    parent_id: number | null;
    children: ApfsOrganizationNode[];
}

export type OrgOption = Pick<ApfsOrganizationNode, 'id' | 'full_name'>;

@Injectable({ providedIn: 'root' })
export class ApfsOrganizationService {
    private readonly http = inject(HttpClient);

    // Authenticated/admin routes
    private readonly baseUrl = `${environment.apiBaseUrl}/apfs-organization`;

    // Public routes (for unauthenticated request-account form)
    private readonly publicBaseUrl = `${environment.apiBaseUrl}/public/apfs-organization`;

    /**
     * Full organization tree (use sparingly – large payload)
     * Typically Admin / Super users only
     */
    getTree(opts?: { activeOnly?: boolean; rootId?: number }): Observable<ApfsOrganizationNode[] | ApfsOrganizationNode> {
        const params = this.buildParams(opts);
        return this.http.get<ApfsOrganizationNode[] | ApfsOrganizationNode>(`${this.baseUrl}/tree`, { params });
    }

    /**
     * Organization tree scoped to current Admin's component
     * Recommended for Admin UI
     */
    getScopedTree(opts?: { activeOnly?: boolean }): Observable<ApfsOrganizationNode | ApfsOrganizationNode[]> {
        const params = this.buildParams(opts);
        return this.http.get<ApfsOrganizationNode | ApfsOrganizationNode[]>(`${this.baseUrl}/tree/scoped`, { params });
    }

    /**
     * Public flat list of organizations for dropdowns (unauthenticated safe)
     * Server should return: [{ id, full_name }]
     */
    getPublicOrganizations(opts?: { activeOnly?: boolean }): Observable<OrgOption[]> {
        const params = this.buildParams({ activeOnly: opts?.activeOnly ?? true });
        return this.http.get<OrgOption[]>(`${this.publicBaseUrl}/options`, { params });
    }

    /**
     * Flat list of organizations for dropdowns
     * - Logged in Admin -> uses scoped tree + flattens
     * - Not logged in (or forbidden) -> falls back to public options endpoint
     */
    getOrganizations(opts?: { activeOnly?: boolean }): Observable<OrgOption[]> {
        const activeOnly = opts?.activeOnly ?? true;

        return this.getScopedTree({ activeOnly }).pipe(
            map(tree => {
                const nodes = Array.isArray(tree) ? tree : [tree];
                const flat = this.flatten(nodes);

                const filtered = activeOnly ? flat.filter(o => o.active === 1) : flat;

                // de-dupe while preserving order
                const seen = new Set<number>();
                return filtered
                    .filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)))
                    .map(o => ({ id: o.id, full_name: o.full_name }));
            }),

            // Any failure (401/403 for anon/non-admin, network errors, etc) -> use public list
            catchError(() => this.getPublicOrganizations({ activeOnly }))
        );
    }

    // ------------------------
    // CRUD (Admin / Auth only)
    // ------------------------

    create(body: {
        name: string;
        acronym: string;
        full_name: string;
        active: 0 | 1;
        parent_id: number | null;
    }): Observable<ApfsOrganizationNode> {
        return this.http.post<ApfsOrganizationNode>(`${this.baseUrl}`, body);
    }

    update(
        id: number,
        body: {
            name: string;
            acronym: string;
            full_name: string;
            active: 0 | 1;
            parent_id: number | null;
        }
    ): Observable<ApfsOrganizationNode> {
        return this.http.put<ApfsOrganizationNode>(`${this.baseUrl}/${id}`, body);
    }

    getById(id: number): Observable<ApfsOrganizationNode> {
        return this.http.get<ApfsOrganizationNode>(`${this.baseUrl}/${id}`);
    }

    // ------------------------
    // Helpers
    // ------------------------

    private flatten(nodes: ApfsOrganizationNode[]): ApfsOrganizationNode[] {
        const result: ApfsOrganizationNode[] = [];

        const walk = (list: ApfsOrganizationNode[]) => {
            for (const n of list) {
                result.push(n);
                if (Array.isArray(n.children) && n.children.length) {
                    walk(n.children);
                }
            }
        };

        walk(nodes);
        return result;
    }

    private buildParams(opts?: { activeOnly?: boolean; rootId?: number }): HttpParams {
        let params = new HttpParams();

        if (opts?.activeOnly) params = params.set('active', '1');
        if (opts?.rootId !== undefined && opts?.rootId !== null) params = params.set('rootId', String(opts.rootId));

        return params;
    }
}
