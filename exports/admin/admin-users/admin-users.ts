import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap, tap } from 'rxjs/operators';



import { User } from '../../../core/models/user.model';

type UsersResponse = User[];


@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-users.html',
  styleUrls: ['./admin-users.css'],
})
export class AdminUsers {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly q = new FormControl<string>('', { nonNullable: true });

  loading = false;
  error: string | null = null;

  readonly users$: Observable<User[]> = this.q.valueChanges.pipe(
    startWith(this.q.value),
    debounceTime(250),
    distinctUntilChanged(),
    tap(() => {
      this.loading = true;
      this.error = null;
    }),
    switchMap((q) => this.fetchUsers(q).pipe(
      catchError((err) => {
        // keep error message simple & UI-friendly
        const msg =
          err?.status === 401 ? 'Unauthorized (are you logged in as Admin?)' :
            err?.status === 403 ? 'Forbidden (Admin only)' :
              err?.error?.message ? String(err.error.message) :
                'Failed to load users';
        this.error = msg;
        return of([] as User[]);
      })
    )),
    tap(() => (this.loading = false))
  );

  clearSearch(): void {
    this.q.setValue('');
  }

  trackById(_i: number, u: User): number {
    return u.id;
  }

  private fetchUsers(q: string): Observable<User[]> {
    const trimmed = (q || '').trim().toLowerCase();

    return this.http.get<User[]>('/api/users').pipe(
      map((users) => {
        const list = Array.isArray(users) ? users : [];
        if (!trimmed) return list;

        return list.filter((u) => {
          const hay = [
            u.firstName,
            u.lastName,
            u.email,
            u.role,
            u.component,
            u.office,
            u.title,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return hay.includes(trimmed);
        });
      })
    );
  }

  startEditUser(u: User): void {
    this.router.navigate(['/admin/users', u.id, 'edit']);
  }


  cancelEdit(): void {
    // If your table has an inline edit mode later, this will reset it.
    // For now it can just no-op.
  }

}
