import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { AuthSession, UserLoginRequest } from './auth.model';
import { User } from '../core/models/user.model';

const SESSION_KEY = 'apfs_auth_session_v1';

type LoginResponse = { token: string; user: User };
type MeResponse = { user: User };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private sessionSubject = new BehaviorSubject<AuthSession | null>(this.loadSession());
  readonly session$ = this.sessionSubject.asObservable();

  get session(): AuthSession | null {
    return this.sessionSubject.value;
  }

  get user(): User | null {
    return this.session?.user ?? null;
  }

  get isLoggedIn(): boolean {
    return !!this.session;
  }

  /** System Administration access */
  get isAdmin(): boolean {
    // matches your db.json user role: "Admin"
    return this.user?.role === 'Admin';
  }


  /**
   * DEV login:
   * - requires password === 'password' (same behavior you had)
   * - username is treated as email OR a short alias (admin/requirements/contracting/coordinator)
   * - user is loaded from the backend user table (db.json)
   */
  login(req: UserLoginRequest): Observable<AuthSession> {
    if (req.password !== 'password') {
      return throwError(() => new Error('Invalid username or password'));
    }

    const raw = String(req.username || '').trim();
    if (!raw) {
      return throwError(() => new Error('Invalid username or password'));
    }

    const email = this.toEmail(raw);

    return this.http.post<LoginResponse>('/api/auth/login', { email }).pipe(
      map(({ token, user }) => {
        const session: AuthSession = { token, user };
        return session;
      }),
      tap((s) => this.saveSession(s)),
      catchError((err) => {
        // Normalize message for UI
        const msg =
          err?.status === 401 ? 'Invalid username or password' :
            err?.error?.error ? String(err.error.error) :
              err?.message ? String(err.message) :
                'Login failed';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Call this on app startup (AppComponent / AppInitializer) to restore the
   * current user from the server if you have a stored session/email.
   *
   * In DEV mode, backend supports x-user-email header (or ?email=).
   */
  loadMe(): Observable<User> {
    const email = this.session?.user?.email || this.getStoredEmail();
    if (!email) {
      return throwError(() => new Error('No session'));
    }

    const headers = new HttpHeaders({ 'x-user-email': email });

    return this.http.get<MeResponse>('/api/auth/me', { headers }).pipe(
      tap((r) => {
        // keep existing token if present (dev token is stable, but this is safe)
        const token = this.session?.token || 'dev-token';
        this.saveSession({ token, user: r.user });
      }),
      map((r) => r.user),
      catchError((err) => {
        // If server says unauthorized, clear local session
        if (err?.status === 401) this.saveSession(null);
        return throwError(() => new Error('Session expired'));
      })
    );
  }

  logout(): void {
    this.saveSession(null);
  }

  // -----------------------
  // Session storage helpers
  // -----------------------

  private saveSession(session: AuthSession | null): void {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      // DEV helper: store email explicitly for /auth/me header use
      sessionStorage.setItem(`${SESSION_KEY}_email`, session.user?.email ?? '');
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(`${SESSION_KEY}_email`);
    }
    this.sessionSubject.next(session);
  }

  private loadSession(): AuthSession | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private getStoredEmail(): string {
    return String(sessionStorage.getItem(`${SESSION_KEY}_email`) || '').trim();
  }

  /**
   * Accept either:
   *  - full email: admin@example.gov
   *  - legacy aliases: admin / requirements / contracting / coordinator
   */
  private toEmail(usernameOrEmail: string): string {
    const v = usernameOrEmail.trim().toLowerCase();

    if (v.includes('@')) return v;

    // Backwards compatible aliases (optional)
    const aliasMap: Record<string, string> = {
      admin: 'admin@example.gov',
      requirements: 'requirements@example.gov',
      contracting: 'contracting@example.gov',
      coordinator: 'coordinator@example.gov',
    };

    return aliasMap[v] ?? v; // if they typed something weird, let backend reject it
  }
}
