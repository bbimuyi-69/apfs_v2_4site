import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ForecastRecord } from '../../models/forecast-record.model';

export type ForecastRecordPrintHistoryItem = {
  id: number | string;
  at: string;
  atIso?: string;
  title?: string;
  actor?: string;
  comment?: string;
  assignment?: string;
  assignmentTo?: string;
  assignmentFrom?: string;
  fromState?: string;
  toState?: string;
  isLatest?: boolean;
};

@Component({
  selector: 'app-forecast-record-print',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forecast-record-print.html',
  styleUrls: ['./forecast-record-print.css'],
})
export class ForecastRecordPrintComponent {
  @Input() record: ForecastRecord | null = null;
  @Input() historyItems: ForecastRecordPrintHistoryItem[] = [];

  get publishedDate(): string {
    const r: any = this.record;
    return this.formatDate(r?.publishedDate) || this.findPublishedDate();
  }

  get previouslyPublishedOn(): string {
    return this.findPreviousPublishedDate();
  }

  get performance(): string {
    const r: any = this.record;
    const s = r?.estimatedPopStart;
    const e = r?.estimatedPopEnd;
    return s && e ? `${s} - ${e}` : s || e || '';
  }

  get pocName(): string {
    const r: any = this.record;
    return [r?.primaryContactFirstName, r?.primaryContactLastName]
      .filter(Boolean)
      .join(' ');
  }

  get coordName(): string {
    const r: any = this.record;
    return [r?.sbSpecialistFirstName, r?.sbSpecialistLastName]
      .filter(Boolean)
      .join(' ');
  }

  get contractVehicle(): string {
    const r: any = this.record;
    return r?.strategicSourcingVehicle || 'None';
  }

  get place(): string {
    const r: any = this.record;
    return [r?.placeOfPerformanceCity, r?.placeOfPerformanceState]
      .filter(Boolean)
      .join(', ');
  }

  trackByHistory(_: number, h: ForecastRecordPrintHistoryItem) {
    return h.id;
  }

  private formatDate(v: any): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString();
  }

  private findPublishedDate(): string {
    const h = this.historyItems
      .filter(x => x.toState?.toLowerCase() === 'published')
      .sort((a, b) => new Date(b.atIso || b.at).getTime() - new Date(a.atIso || a.at).getTime());
    return h[0] ? this.formatDate(h[0].at) : '';
  }

  private findPreviousPublishedDate(): string {
    const h = this.historyItems
      .filter(x => x.toState?.toLowerCase() === 'published')
      .sort((a, b) => new Date(b.atIso || b.at).getTime() - new Date(a.atIso || a.at).getTime());
    return h[1] ? this.formatDate(h[1].at) : '';
  }
}