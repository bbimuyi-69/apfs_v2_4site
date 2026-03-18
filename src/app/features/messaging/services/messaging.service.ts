import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';

export interface UserNotification {
    id: number;
    time: string;
    subject: string;
    body: string;
    read: 0 | 1;
    user_id: number;
}

@Injectable({
    providedIn: 'root'
})
export class MessagingService {
    private baseUrl = '/api/user-notifications';

    constructor(private http: HttpClient) { }

    list(userId: number): Observable<UserNotification[]> {
        const params = new HttpParams().set('userId', String(userId));

        return this.http.get<any>(this.baseUrl, { params }).pipe(
            map(res => res?.items ?? [])
        );
    }

    getById(id: number): Observable<UserNotification> {
        return this.http.get<UserNotification>(`${this.baseUrl}/${id}`);
    }

    markRead(id: number, read: 0 | 1): Observable<UserNotification> {
        return this.http.patch<UserNotification>(
            `${this.baseUrl}/${id}/read`,
            { read }
        );
    }

    markMany(ids: number[], read: 0 | 1): Observable<any> {
        const calls = ids.map(id =>
            this.markRead(id, read)
        );
        return forkJoin(calls);
    }

    deleteMany(ids: number[]): Observable<any> {
        const calls = ids.map(id =>
            this.http.delete(`${this.baseUrl}/${id}`)
        );
        return forkJoin(calls);
    }
}