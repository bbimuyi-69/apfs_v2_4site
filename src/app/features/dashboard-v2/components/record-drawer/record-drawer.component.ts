import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ForecastRecord } from '../../../forecast/forecast-record/models/forecast-record.model';
import { ForecastRecordService } from '../../../forecast/forecast-record/services/forecast-record.service';
import { AuthService } from '../../../../auth/auth.service';

@Component({
  selector: 'app-record-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './record-drawer.component.html',
  styleUrls: ['./record-drawer.component.css'],
})
export class RecordDrawerComponent {
  private readonly router = inject(Router);
  private readonly service = inject(ForecastRecordService);
  private readonly auth = inject(AuthService);

  @Input({ required: true }) record!: ForecastRecord;

  @Output() close = new EventEmitter<void>();
  @Output() recordUpdated = new EventEmitter<ForecastRecord>();

  closing = false;
  private busy = false;

  get assignedToName(): string {
    const r: any = this.record as any;
    return (
      r?.assignedToName ??
      r?.assignedToDisplayName ??
      r?.assignedToUserName ??
      r?.assignedToEmail ??
      '—'
    );
  }

  isBusy(): boolean {
    return this.busy;
  }

  canClaim(): boolean {
    return !this.record?.assignedToUserId && !this.busy;
  }

  onClaim(): void {
    if (this.busy) return;

    const id = this.record?.id;
    if (typeof id !== 'number') {
      console.warn('[RecordDrawer] Cannot claim record — invalid or missing id', this.record);
      return;
    }

    const user = this.auth.user;
    if (!user) {
      console.warn('[RecordDrawer] Cannot claim record — no logged-in user/session');
      return;
    }

    this.busy = true;

    const payload = {
      userId: String(user.id),
      userName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Unknown User',
    };

    this.service
      .claim(id, payload)
      .subscribe({
        next: (updated) => {
          this.record = updated;
          this.recordUpdated.emit(updated);
        },
        error: (err) => {
          console.error('[RecordDrawer] Claim failed', err);
        },
      })
      .add(() => {
        this.busy = false;
      });
  }


  openRecord(): void {
    const id = (this.record as any)?.id;
    if (!id) return;

    this.requestClose();

    this.router.navigate(['/forecast', id], {
      queryParams: { mode: 'edit' },
    });
  }

  requestClose(): void {
    if (this.closing) return;
    this.closing = true;
    setTimeout(() => this.close.emit(), 180);
  }
}
