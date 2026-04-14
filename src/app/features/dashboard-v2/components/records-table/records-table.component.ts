import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForecastRecord } from '../../../forecast/forecast-record/models/forecast-record.model';

@Component({
  selector: 'app-records-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './records-table.component.html',
  styleUrl: './records-table.component.css',
})
export class RecordsTableComponent {
  @Input() rows: ForecastRecord[] = [];
  @Output() rowClick = new EventEmitter<ForecastRecord>();

  pillClass(status: string) {
    const s = String(status ?? '');
    if (s === 'Rejected') return 'pill pill--danger';
    return 'pill pill--info';
  }

  updatedLabel(r: any): string {
    const raw = r?.updatedAt ?? r?.createdAt;
    if (!raw) return '—';

    const d = new Date(raw);

    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  assignedLabel(r: ForecastRecord) {
    const name = String((r as any).assignedToName ?? '').trim();
    return name || '—';
  }
}
