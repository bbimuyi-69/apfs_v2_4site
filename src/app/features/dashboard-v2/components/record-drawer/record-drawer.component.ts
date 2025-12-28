import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ForecastRecord } from '../../../forecast/forecast-record/models/forecast-record.model';
import { ForecastRecordService } from '../../../forecast/forecast-record/forecast-record/forecast-record.service';
import { AuthService } from '../../../../auth/auth.service';

@Component({
  selector: 'app-record-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './record-drawer.component.html',
  styleUrl: './record-drawer.component.css',
})
export class RecordDrawerComponent {
  @Input() record: ForecastRecord | null = null;
  @Output() close = new EventEmitter<void>();

  get assignedToName(): string {
    if (!this.record) return '—';
    return (this.record as any).assignedToName || '—';
  }

  private readonly busy = signal(false);
  readonly isBusy = computed(() => this.busy());

  constructor(
    private router: Router,
    private svc: ForecastRecordService,
    private auth: AuthService,
  ) { }

  isOpen() { return !!this.record; }

  openRecord() {
    const id = this.record?.id;
    if (!id) return;
    this.router.navigate(['/forecast', String(id)]);
  }

  private getMyUserId(): string {
    const a: any = this.auth as any;
    const u =
      a?.currentUser ??
      (typeof a?.getCurrentUser === 'function' ? a.getCurrentUser() : null);
    return (
      u?.id ??
      u?.userId ??
      u?.oid ??
      u?.sub ??
      u?.upn ??
      u?.email ??
      'mock-user'
    );
  }

  private getMyName(): string {
    const a: any = this.auth as any;
    const u =
      a?.currentUser ??
      (typeof a?.getCurrentUser === 'function' ? a.getCurrentUser() : null);
    return u?.displayName ?? u?.name ?? 'User';
  }

  canClaim(): boolean {
    const r: any = this.record as any;
    if (!r?.id) return false;
    return !String(r.assignedToUserId ?? '').trim();
  }

  claim() {
    const id = this.record?.id;
    if (!id || this.busy()) return;
    this.busy.set(true);

    this.svc.claim(id, { userId: this.getMyUserId(), userName: this.getMyName() }).subscribe({
      next: (updated) => {
        // update local reference so the drawer updates immediately
        this.record = updated;
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }
}
