import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForecastRecord } from '../../../forecast/forecast-record/models/forecast-record.model';

@Component({
  selector: 'app-workflow-health',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow-health.component.html',
  styleUrl: './workflow-health.component.css',
})
export class WorkflowHealthComponent {
  private _rows = signal<ForecastRecord[]>([]);
  @Input() set rows(v: ForecastRecord[]){ this._rows.set(Array.isArray(v) ? v : []); }

  readonly workable = computed(() => {
    const WORKABLE = new Set(['Draft','Submitted','InReview','NeedsInfo']);
    return this._rows().filter(r => WORKABLE.has(String((r as any).status ?? 'Draft')));
  });

  readonly queueCount = computed(() => this.workable().filter(r => !String((r as any).assignedToUserId ?? '').trim()).length);
  readonly claimedCount = computed(() => this.workable().filter(r => !!String((r as any).assignedToUserId ?? '').trim()).length);

  readonly avgAgeDays = computed(() => {
    const rows = this.workable();
    if (!rows.length) return 0;
    const now = Date.now();
    const ages = rows.map(r => {
      const t = new Date((r as any).updatedAt ?? (r as any).createdAt ?? now).getTime();
      return Math.max(0, (now - t) / (1000*60*60*24));
    });
    return Math.round((ages.reduce((a,b)=>a+b,0)/ages.length) * 10) / 10;
  });
}
