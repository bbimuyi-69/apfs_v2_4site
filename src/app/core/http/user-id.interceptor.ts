import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class UserIdHeaderInterceptor implements HttpInterceptor {
    private readonly auth = inject(AuthService);

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Only attach for API calls
        if (!req.url.includes('/api/')) return next.handle(req);

        const id = (this.auth as any)?.session?.user?.id ?? (this.auth as any)?.user?.id ?? null;
        const userId = id != null ? String(id) : '';

        if (!userId) return next.handle(req);

        return next.handle(
            req.clone({
                setHeaders: { 'x-user-id': userId },
            })
        );
    }
}
