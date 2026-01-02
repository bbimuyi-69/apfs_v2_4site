import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ForecastRecord } from '../../../forecast/forecast-record/models/forecast-record.model';
import { ForecastRecordService } from '../../../forecast/forecast-record/services/forecast-record.service';

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
    if (!this.record?.id || this.busy) return;

    this.busy = true;

    this.service.claim(this.record.id).subscribe({
      next: (updated) => {
        this.record = updated;
        this.recordUpdated.emit(updated);
        this.busy = false;
      },
      error: (e) => {
        console.error('Claim failed', e);
        this.busy = false;
      },
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
