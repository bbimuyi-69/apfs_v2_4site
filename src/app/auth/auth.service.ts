import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { AuthSession, UserLoginRequest } from './auth.model';
import { User } from '../core/models/user.model';

const SESSION_KEY = 'apfs_auth_session_v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
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

  login(req: UserLoginRequest): Observable<AuthSession> {
    // TODO: replace with real API call (HttpClient)
    if (req.username !== 'admin' || req.password !== 'password') {
      return throwError(() => new Error('Invalid username or password'));
    }

    const user: User = {
      id: 1,
      firstName: 'Admin',
      lastName: 'User',
      title: 'Contract Specialist',
      email: 'admin@example.gov',
      employeeType: 'Federal Employee',
      component: 'DHS',
      role: 'Contracting Office',
      office: 'HQ',
      isActive: true
    };

    const session: AuthSession = {
      user,
      token: 'mock-token-123'
    };

    return of(session).pipe(
      delay(400),
      tap(s => this.saveSession(s)) // ✅ persists + updates observable
    );
  }

  logout(): void {
    this.saveSession(null);
  }

  private saveSession(session: AuthSession | null): void {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
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
}
