import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OfficeRow {
    id: number;
    name: string;
    full_name: string;
    active: number;
    office_assignment_permissions_level_id: number;
    organization_id: number;
    aac_code?: string;
}

@Injectable({ providedIn: 'root' })
export class ApfsOfficeService {

    private baseUrl = '/api';

    constructor(private http: HttpClient) { }

    list(params?: {
        active?: number;
        organizationId?: number;
        search?: string;
    }): Observable<OfficeRow[]> {

        let httpParams = new HttpParams();

        if (params?.active != null)
            //httpParams = httpParams.set('active', String(params.active));

            if (params?.organizationId != null)
                httpParams = httpParams.set('organizationId', String(params.organizationId));

        if (params?.search)
            httpParams = httpParams.set('search', params.search);

        return this.http.get<OfficeRow[]>(`${this.baseUrl}/offices`, { params: httpParams });
    }

    get(id: number) {
        return this.http.get<OfficeRow>(`${this.baseUrl}/offices/${id}`);
    }

    create(payload: Partial<OfficeRow>) {
        return this.http.post<OfficeRow>(`${this.baseUrl}/offices`, payload);
    }

    update(id: number, payload: Partial<OfficeRow>) {
        return this.http.put<OfficeRow>(`${this.baseUrl}/offices/${id}`, payload);
    }

    deactivate(id: number) {
        return this.http.delete(`${this.baseUrl}/offices/${id}`);
    }
}
