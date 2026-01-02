import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { AuthSession, UserLoginRequest } from './auth.model';
import { User } from '../core/models/user.model';

const SESSION_KEY = 'apfs_auth_session_v1';

/**
 * Mock users for role-based testing.
 * Login with:
 *  - admin / password
 *  - requirements / password
 *  - contracting / password
 *  - coordinator / password
 */
const MOCK_USERS: Record<string, User> = {
  admin: {
    id: 1,
    firstName: 'Admin',
    lastName: 'User',
    title: 'Contract Specialist',
    email: 'admin@example.gov',
    employeeType: 'Federal Employee',
    component: 'DHS',
    role: 'Contracting Office',
    office: 'HQ',
    isActive: true,
  },

  requirements: {
    id: 2,
    firstName: 'Riley',
    lastName: 'Requirements',
    title: 'Requirements Analyst',
    email: 'requirements@example.gov',
    employeeType: 'Federal Employee',
    component: 'DHS',
    role: 'Requirements',
    office: 'Program Office',
    isActive: true,
  },

  contracting: {
    id: 3,
    firstName: 'Casey',
    lastName: 'Contracting',
    title: 'Contracting Officer',
    email: 'contracting@example.gov',
    employeeType: 'Federal Employee',
    component: 'DHS',
    role: 'Contracting Office',
    office: 'Acquisitions',
    isActive: true,
  },

  coordinator: {
    id: 4,
    firstName: 'Alex',
    lastName: 'Coordinator',
    title: 'APFS Coordinator',
    email: 'coordinator@example.gov',
    employeeType: 'Federal Employee',
    component: 'DHS',
    role: 'APFS Coordinator',
    office: 'HQ',
    isActive: true,
  },
};

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
    if (req.password !== 'password') {
      return throwError(() => new Error('Invalid username or password'));
    }

    const key = req.username?.toLowerCase();
    const user = key ? MOCK_USERS[key] : undefined;

    if (!user) {
      return throwError(() => new Error('Invalid username or password'));
    }

    const session: AuthSession = {
      user,
      token: `mock-token-${user.id}`,
    };

    return of(session).pipe(
      delay(400),
      tap(s => this.saveSession(s))
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
