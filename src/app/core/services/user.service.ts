import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { User } from '../../core/models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  currentUser: any;
  constructor(private http: HttpClient) { }

  // Base API URL (server)
  private readonly apiUrl = 'http://localhost:3000';

  // Users endpoint
  private readonly usersUrl = `${this.apiUrl}/api/users`;

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.usersUrl);
  }

  getUsersById(id: number): Observable<User> {
    return this.http.get<User>(`${this.usersUrl}/${id}`);
  }

  requestNewUser(user: User): Observable<User> {
    return this.http.post<User>(this.usersUrl, user);
  }

  createUser(payload: any) {
    return this.http.post<User>('/api/users', payload);
  }

  updateUser(id: number, payload: any) {
    return this.http.patch<User>(`/api/users/${id}`, payload);
  }
  deleteUser(id: number) {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
