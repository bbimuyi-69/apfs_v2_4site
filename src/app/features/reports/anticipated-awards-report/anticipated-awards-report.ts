import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  AnticipatedAwardsReportService,
  AnticipatedAwardsRow,
  ReportCriteria
} from '../services/anticipated-awards-report.service';

import { ForecastRecord } from '../../forecast/forecast-record/models/forecast-record.model';
import {
  ForecastRecordService,
  RecordHistoryRow
} from '../../forecast/forecast-record/services/forecast-record.service';

type SortDirection = 'asc' | 'desc';

type SortKey =
  | 'component'
  | 'under250k'
  | 'k250To500'
  | 'k500To1m'
  | 'm1To2'
  | 'm2To5'
  | 'm5To10'
  | 'm10To20'
  | 'm20To50'
  | 'm50To100'
  | 'over100m'
  | 'total';

type ExpandedRecord = {
  id: number | string;
  apfsNumber?: string | null;
  requirementsTitle?: string | null;
  dollarRange?: string | null;
  component?: string | null;
  office?: string | null;
  requirementsOffice?: string | null;
  contractingOffice?: string | null;
  coordinatorOffice?: string | null;
  anticipatedAwardDate?: string | null;
};

type RecordHistoryItemVM = {
  id: number | string;
  at: string;
  atIso?: string;
  title: string;
  actor: string;
  comment?: string;
  assignment?: string;
  assignmentTo?: string;
  assignmentFrom?: string;
  fromState?: string;
  toState?: string;
  isLatest: boolean;
};

@Component({
  selector: 'app-anticipated-awards-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anticipated-awards-report.html',
  styleUrls: ['./anticipated-awards-report.css']
})
export class AnticipatedAwardsReport {
  private service = inject(AnticipatedAwardsReportService);
  private forecastRecordService = inject(ForecastRecordService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  sortKey: SortKey | null = null;
  sortDirection: SortDirection = 'asc';

  private readonly sortLabels: Record<SortKey, string> = {
    component: 'Component',
    under250k: 'under $250K',
    k250To500: '$250K to $500K',
    k500To1m: '$500K to $1M',
    m1To2: '$1M to $2M',
    m2To5: '$2M to $5M',
    m5To10: '$5M to $10M',
    m10To20: '$10M to $20M',
    m20To50: '$20M to $50M',
    m50To100: '$50M to $100M',
    over100m: 'Over $100M',
    total: 'Total'
  };

  showFilters = true;
  lastRan = false;
  resultsVisible = false;

  componentText = '';
  officeText = '';
  anticipatedAwardStart = '';
  anticipatedAwardEnd = '';

  searchText = '';
  filterLabel = '';

  rows: AnticipatedAwardsRow[] = [];
  allRecords: any[] = [];

  expandedComponent: string | null = null;
  expandedRows: ExpandedRecord[] = [];

  // left record panel
  recordPanelOpen = false;
  recordPanelLoading = false;
  selectedRecordId: number | null = null;
  selectedRecord: ForecastRecord | null = null;
  recordHistory: RecordHistoryRow[] = [];
  recordHistoryItems: RecordHistoryItemVM[] = [];

  private splitCsv(s: string): string[] {
    return (s ?? '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  }

  setSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }

    this.filterLabel = `Ordered by ${this.sortLabels[key]} in ${this.sortDirection === 'asc' ? 'ascending' : 'descending'} order`;
    this.cdr.detectChanges();
  }

  isSorted(key: SortKey): boolean {
    return this.sortKey === key;
  }

  sortArrow(key: SortKey): string {
    if (this.sortKey !== key) return '⇵';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  get displayRows(): AnticipatedAwardsRow[] {
    const rows = [...this.rows];

    if (!this.sortKey) {
      return rows;
    }

    const key = this.sortKey;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    return rows.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (a.component === 'TOTAL' && b.component !== 'TOTAL') return -1;
      if (b.component === 'TOTAL' && a.component !== 'TOTAL') return 1;

      if (key === 'component') {
        return String(aVal ?? '').localeCompare(String(bVal ?? '')) * dir;
      }

      return (Number(aVal ?? 0) - Number(bVal ?? 0)) * dir;
    });
  }

  run(): void {
    const criteria: ReportCriteria = {
      component: this.splitCsv(this.componentText),
      office: this.splitCsv(this.officeText),
      anticipatedAwardStart: this.anticipatedAwardStart || null,
      anticipatedAwardEnd: this.anticipatedAwardEnd || null,
      publishedOnly: true
    };

    this.service.getReport(criteria).subscribe(res => {
      this.rows = res.rows;
      this.allRecords = res.allRecords;

      this.sortKey = null;
      this.sortDirection = 'asc';
      this.filterLabel = this.buildFilterLabel(criteria);

      this.lastRan = true;
      this.resultsVisible = true;
      this.showFilters = false;
      this.expandedComponent = null;
      this.expandedRows = [];
      this.closeRecordPanel();

      this.cdr.detectChanges();
    });
  }

  reset(): void {
    this.componentText = '';
    this.officeText = '';
    this.anticipatedAwardStart = '';
    this.anticipatedAwardEnd = '';

    this.rows = [];
    this.allRecords = [];
    this.expandedComponent = null;
    this.expandedRows = [];
    this.lastRan = false;
    this.resultsVisible = false;
    this.filterLabel = '';
    this.showFilters = true;

    this.closeRecordPanel();
    this.cdr.detectChanges();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    this.cdr.detectChanges();
  }

  openDetails(row: AnticipatedAwardsRow): void {
    if (this.expandedComponent === row.component) {
      this.expandedComponent = null;
      this.expandedRows = [];
      this.cdr.detectChanges();
      return;
    }

    const records =
      row.component === 'TOTAL'
        ? this.allRecords
        : this.allRecords.filter(r => (r.component || r.organization) === row.component);

    this.expandedComponent = row.component;
    this.expandedRows = records.map((r: any) => ({
      id: r.id,
      apfsNumber: r.apfsNumber ?? r.apfs_number ?? '',
      requirementsTitle: r.requirementsTitle ?? '',
      dollarRange: r.dollarRange ?? '',
      component: r.component ?? r.organization ?? '',
      office:
        r.office ??
        r.requirementsOffice ??
        r.contractingOffice ??
        r.coordinatorOffice ??
        '',
      requirementsOffice: r.requirementsOffice ?? '',
      contractingOffice: r.contractingOffice ?? '',
      coordinatorOffice: r.coordinatorOffice ?? '',
      anticipatedAwardDate: r.anticipatedAwardDate ?? r.anticipated_award_date ?? ''
    }));

    this.cdr.detectChanges();
  }

  isExpanded(row: AnticipatedAwardsRow): boolean {
    return this.expandedComponent === row.component;
  }

  openRecord(row: ExpandedRecord): void {
    const rawId = row?.id;
    const recordId = typeof rawId === 'number' ? rawId : Number(rawId);

    if (!recordId || Number.isNaN(recordId)) return;

    this.selectedRecordId = recordId;
    this.selectedRecord = null;
    this.recordHistory = [];
    this.recordHistoryItems = [];
    this.recordPanelLoading = true;
    this.recordPanelOpen = true;
    this.cdr.detectChanges();

    this.forecastRecordService.getById(recordId).subscribe({
      next: (record: ForecastRecord) => {
        this.selectedRecord = record;

        const history = ((record as any)?.history ?? []) as RecordHistoryRow[];
        this.recordHistory = history;
        this.recordHistoryItems = this.mapHistoryItems(history);

        this.recordPanelLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('record load error', err);
        this.selectedRecord = null;
        this.recordHistory = [];
        this.recordHistoryItems = [];
        this.recordPanelLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeRecordPanel(): void {
    this.recordPanelOpen = false;
    this.selectedRecordId = null;
    this.selectedRecord = null;
    this.recordHistory = [];
    this.recordHistoryItems = [];
    this.recordPanelLoading = false;
    this.cdr.detectChanges();
  }

  printRecord(): void {
    window.print();
  }

  goToRecord(): void {
    const id = this.selectedRecordId ?? this.selectedRecord?.id ?? null;
    if (!id) return;

    this.router.navigate(['/forecast', id]).then(ok => {
      if (ok) {
        this.closeRecordPanel();
      }
    }).catch(err => {
      console.error('Navigation error', err);
    });
  }

  trackExpandedRecord(index: number, row: ExpandedRecord): number | string {
    return row.id ?? row.apfsNumber ?? index;
  }

  trackHistory(index: number, row: RecordHistoryItemVM): number | string {
    return row.id ?? index;
  }

  private buildFilterLabel(c: ReportCriteria): string {
    const parts: string[] = [];

    if (c.component?.length) parts.push(c.component.join(', '));
    if (c.office?.length) parts.push(c.office.join(', '));

    if (!parts.length) return 'Forecasts shown for Total';
    return `Forecasts shown for ${parts.join(' / ')}`;
  }

  private mapHistoryItems(rows: RecordHistoryRow[] | null | undefined): RecordHistoryItemVM[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    return rows.map((h) => {
      const iso = h.time ?? null;
      const actor = h.user_display?.toString().trim() || 'Unknown';
      const comment = h.user_comment?.toString().trim() || undefined;
      const assignment = h.assignment_display?.toString().trim() || undefined;

      const fromState =
        h.previous_state_id != null ? this.stateName(h.previous_state_id) : '';

      const toState =
        h.new_state_id != null ? this.stateName(h.new_state_id) : '';

      let assignmentTo: string | undefined;
      let assignmentFrom: string | undefined;

      if (comment === 'Unassigned') {
        assignmentTo = 'unassigned';
        assignmentFrom = assignment || actor;
      } else if (assignment) {
        assignmentTo = assignment;
        assignmentFrom = actor;
      }

      let title = 'Updated';
      if (comment === 'Created') {
        title = 'Created';
      } else if (fromState || toState) {
        title = `${fromState} → ${toState}`;
      } else if (assignment) {
        title = 'Assignment Updated';
      }

      return {
        id: h.id ?? `${iso}-${actor}`,
        at: this.formatWhen(iso),
        atIso: iso ?? undefined,
        title,
        actor,
        comment,
        assignment,
        assignmentTo,
        assignmentFrom,
        fromState,
        toState,
        isLatest: Number(h.latest) === 1,
      };
    });
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
      case 0: return 'Draft';
      case 1: return 'Requirements';
      case 2: return 'Contracting';
      case 3: return 'Coordinator';
      case 4: return 'Published';
      default: return 'Updated';
    }
  }
}