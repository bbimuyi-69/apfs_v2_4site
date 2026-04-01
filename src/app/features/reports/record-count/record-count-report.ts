import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  RecordCountCriteria,
  RecordCountReportService,
  RecordCountRow,
  RecordCountStatus
} from '../services/record-count-report.service';

import { ForecastRecord } from '../../forecast/forecast-record/models/forecast-record.model';
import {
  ForecastRecordService,
  RecordHistoryRow
} from '../../forecast/forecast-record/services/forecast-record.service';

type SortDirection = 'asc' | 'desc';
type SortKey = 'apfsNumber' | 'component' | 'dollarRange' | 'requirementsTitle';

type RecordHistoryItemVM = {
  id: number | string;
  at: string;
  atIso?: string;
  movedFrom: string;
  movedTo: string;
  assignmentTo?: string;
  assignmentFrom?: string;
};

@Component({
  selector: 'app-record-count-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './record-count-report.html',
  styleUrls: ['./record-count-report.css']
})
export class RecordCountReport {
  private service = inject(RecordCountReportService);
  private forecastRecordService = inject(ForecastRecordService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  sortKey: SortKey = 'apfsNumber';
  sortDirection: SortDirection = 'asc';

  showFilters = true;
  lastRan = false;
  resultsVisible = false;

  status: RecordCountStatus = 'all';
  componentText = '';
  officeText = '';
  startDate = '';
  endDate = '';
  createdAfter = '';
  createdBefore = '';

  filterLabel = 'Report Updated';

  rows: RecordCountRow[] = [];
  total = 0;

  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [10, 25, 50, 100];

  // left record panel
  recordPanelOpen = false;
  recordPanelLoading = false;
  selectedRecordId: number | null = null;
  selectedRecord: ForecastRecord | null = null;
  recordHistoryItems: RecordHistoryItemVM[] = [];



  private splitCsv(s: string): string[] {
    return (s ?? '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  }

  run(): void {
    const criteria: RecordCountCriteria = {
      status: this.status,
      component: this.splitCsv(this.componentText),
      office: this.splitCsv(this.officeText),
      startDate: this.startDate || null,
      endDate: this.endDate || null,
      createdAfter: this.createdAfter || null,
      createdBefore: this.createdBefore || null
    };

    console.log('record-count criteria', criteria);

    this.service.getReport(criteria).subscribe(res => {
      this.rows = res.rows;
      this.total = res.total;
      this.currentPage = 1;

      this.filterLabel = 'Report Updated';
      this.lastRan = true;
      this.resultsVisible = true;
      this.showFilters = false;
      this.closeRecordPanel();

      this.cdr.detectChanges();
    });
  }

  reset(): void {
    this.status = 'all';
    this.componentText = '';
    this.officeText = '';
    this.startDate = '';
    this.endDate = '';
    this.createdAfter = '';
    this.createdBefore = '';

    this.rows = [];
    this.total = 0;
    this.currentPage = 1;
    this.lastRan = false;
    this.resultsVisible = false;
    this.showFilters = true;

    this.closeRecordPanel();
    this.cdr.detectChanges();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    this.cdr.detectChanges();
  }

  setSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  }

  sortArrow(key: SortKey): string {
    if (this.sortKey !== key) return '⇵';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  get sortedRows(): RecordCountRow[] {
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    const rows = [...this.rows];

    return rows.sort((a, b) => {
      const av = String(a[this.sortKey] ?? '');
      const bv = String(b[this.sortKey] ?? '');
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }

  get pagedRows(): RecordCountRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sortedRows.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get showingStart(): number {
    if (!this.total) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.total);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.cdr.detectChanges();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.cdr.detectChanges();
  }

  openRecord(row: RecordCountRow): void {
    const recordId = typeof row.id === 'number' ? row.id : Number(row.id);
    if (!recordId || Number.isNaN(recordId)) return;

    this.selectedRecordId = recordId;
    this.selectedRecord = null;
    this.recordHistoryItems = [];
    this.recordPanelLoading = true;
    this.recordPanelOpen = true;
    this.cdr.detectChanges();

    this.forecastRecordService.getById(recordId).subscribe({
      next: (record: ForecastRecord) => {
        this.selectedRecord = record;
        const history = (((record as any)?.history ?? []) as RecordHistoryRow[]);
        this.recordHistoryItems = this.mapHistoryItems(history);
        this.recordPanelLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('record load error', err);
        this.selectedRecord = null;
        this.recordHistoryItems = [];
        this.recordPanelLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeRecordPanel(): void {
    this.recordPanelOpen = false;
    this.recordPanelLoading = false;
    this.selectedRecordId = null;
    this.selectedRecord = null;
    this.recordHistoryItems = [];
    this.cdr.detectChanges();
  }

  printRecord(): void {
    window.print();
  }

  goToRecord(): void {
    const id = this.selectedRecordId ?? this.selectedRecord?.id ?? null;
    if (!id) return;

    this.router.navigate(['/forecast', id]).then(ok => {
      if (ok) this.closeRecordPanel();
    }).catch(err => console.error('Navigation error', err));
  }

  exportCsv(): void {
    const headers = ['APFS Number', 'Component', 'Dollar Range', 'Requirements Title'];
    const lines = [
      headers.join(','),
      ...this.sortedRows.map(r => [
        this.csv(r.apfsNumber),
        this.csv(r.component),
        this.csv(r.dollarRange),
        this.csv(r.requirementsTitle)
      ].join(','))
    ];

    this.downloadFile(
      new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }),
      'record-count-report.csv'
    );
  }

  exportPdf(): void {
    window.print();
  }

  private csv(v: unknown): string {
    const s = String(v ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  }

  private downloadFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  trackRow(index: number, row: RecordCountRow): number | string {
    return row.id ?? index;
  }

  trackHistory(index: number, row: RecordHistoryItemVM): number | string {
    return row.id ?? index;
  }

  private mapHistoryItems(rows: RecordHistoryRow[] | null | undefined): RecordHistoryItemVM[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    return rows.map((h) => ({
      id: h.id ?? `${h.time}-${h.user_display}`,
      at: this.formatWhen(h.time),
      atIso: h.time ?? undefined,
      movedFrom: this.stateName(h.previous_state_id),
      movedTo: this.stateName(h.new_state_id),
      assignmentTo: h.assignment_display ?? undefined,
      assignmentFrom: h.user_display ?? undefined
    }));
  }

  private formatWhen(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  private stateName(value: number | string | null | undefined): string {
    const n = Number(value);
    switch (n) {
      case 0: return 'New';
      case 1: return 'Requirements';
      case 2: return 'Contracting';
      case 3: return 'Coordinator';
      case 4: return 'Published';
      default: return '';
    }
  }
}