import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  AnticipatedAwardsReportService,
  AnticipatedAwardsRow,
  ReportCriteria
} from '../services/anticipated-awards-report.service';

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

@Component({
  selector: 'app-anticipated-awards-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anticipated-awards-report.html',
  styleUrls: ['./anticipated-awards-report.css']
})
export class AnticipatedAwardsReport {
  private service = inject(AnticipatedAwardsReportService);
  private cdr = inject(ChangeDetectorRef);

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
      this.sortDirection = key === 'component' ? 'asc' : 'asc';
    }

    this.filterLabel = `Ordered by ${this.sortLabels[key]} in ${this.sortDirection === 'asc' ? 'ascending' : 'descending'
      } order`;

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

      // Keep TOTAL row at top unless sorting by component and you want it included
      if (a.component === 'TOTAL' && b.component !== 'TOTAL') return -1;
      if (b.component === 'TOTAL' && a.component !== 'TOTAL') return 1;

      if (key === 'component') {
        return String(aVal ?? '').localeCompare(String(bVal ?? '')) * dir;
      }

      return ((Number(aVal ?? 0) - Number(bVal ?? 0)) * dir);
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
      this.showFilters = false; // hide main filter block after run
      this.expandedComponent = null;
      this.expandedRows = [];
      this.filterLabel = this.buildFilterLabel(criteria);

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

  private buildFilterLabel(c: ReportCriteria): string {
    const parts: string[] = [];

    if (c.component?.length) parts.push(c.component.join(', '));
    if (c.office?.length) parts.push(c.office.join(', '));

    if (!parts.length) return 'Forecasts shown for Total';
    return `Forecasts shown for ${parts.join(' / ')}`;
  }
}