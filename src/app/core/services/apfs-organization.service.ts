import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { map } from 'rxjs/operators';


export interface ApfsOrganizationNode {
    id: number;
    name: string;
    acronym: string;
    full_name: string;
    active: 0 | 1;
    parent_id: number | null;
    children: ApfsOrganizationNode[];
}

@Injectable({ providedIn: 'root' })
export class ApfsOrganizationService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiBaseUrl}/apfs-organization`;

    /**
     * Full organization tree (use sparingly – large payload)
     * Admin / Super users only
     */
    getTree(opts?: {
        activeOnly?: boolean;
        rootId?: number;
    }): Observable<ApfsOrganizationNode[] | ApfsOrganizationNode> {
        const params = this.buildParams(opts);
        return this.http.get<ApfsOrganizationNode[] | ApfsOrganizationNode>(
            `${this.baseUrl}/tree`,
            { params }
        );
    }

    /**
     * Organization tree scoped to current Admin's component
     * Recommended for Admin UI
     */
    getScopedTree(opts?: {
        activeOnly?: boolean;
    }): Observable<ApfsOrganizationNode | ApfsOrganizationNode[]> {
        const params = this.buildParams(opts);
        return this.http.get<ApfsOrganizationNode | ApfsOrganizationNode[]>(
            `${this.baseUrl}/tree/scoped`,
            { params }
        );
    }

    /**
 * Flat list of active organizations for dropdowns
 * Uses scoped tree and flattens it
 */
    getOrganizations(opts?: { activeOnly?: boolean })
        : Observable<Pick<ApfsOrganizationNode, 'id' | 'full_name'>[]> {
        const activeOnly = opts?.activeOnly ?? true;

        return this.getScopedTree({ activeOnly }).pipe(
            map(tree => {
                const nodes = Array.isArray(tree) ? tree : [tree];
                const flat = this.flatten(nodes);

                const filtered = activeOnly ? flat.filter(o => o.active === 1) : flat;

                return filtered.map(o => ({
                    id: o.id,
                    full_name: o.full_name
                }));
            })
        );
    }




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



    // ------------------------
    // Helpers
    // ------------------------

    private buildParams(opts?: { activeOnly?: boolean; rootId?: number }): HttpParams {
        let params = new HttpParams();

        if (opts?.activeOnly) {
            params = params.set('active', '1');
        }

        if (opts?.rootId !== undefined && opts?.rootId !== null) {
            params = params.set('rootId', String(opts.rootId));
        }

        return params;
    }

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

}
