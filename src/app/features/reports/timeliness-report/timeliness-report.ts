import { Component } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, NgIf, NgFor } from '@angular/common';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TimelinessReportService,
  TimelinessSummary,
  TimelinessFilters,
  TimelinessListRow
} from '../services/timeliness-report.service';

type BucketKey =
  | 'MISSING_DATES'
  | 'PAST_DUE'
  | 'DUE_0_30'
  | 'DUE_31_60'
  | 'DUE_61_90'
  | 'DUE_91_180'
  | 'DUE_181_PLUS';

@Component({
  standalone: true,
  selector: 'app-timeliness-report',
  templateUrl: './timeliness-report.html',
  styleUrls: ['./timeliness-report.css'],
  imports: [
    CommonModule,
    FormsModule,
    NgIf,
    NgFor,
    AsyncPipe
  ],
})
export class TimelinessReportComponent {
  showFilters = true;
  lastRan = false;

  componentsText = '';
  requirementsOfficesText = '';
  fiscalYearsText = '';

  startDate = '';
  endDate = '';
  creationDateAfter = '';
  creationDateBefore = '';

  filters: TimelinessFilters = {
    components: [],
    requirementsOffices: [],
    fiscalYears: [],
    startDate: '',
    endDate: '',
    creationDateAfter: '',
    creationDateBefore: '',
  };

  summary$: Observable<TimelinessSummary | null> = of(null);

  readonly bucketKeys: readonly BucketKey[] = [
    'PAST_DUE',
    'DUE_0_30',
    'DUE_31_60',
    'DUE_61_90',
    'DUE_91_180',
    'DUE_181_PLUS',
    'MISSING_DATES',
  ] as const;

  drawerOpen = false;
  drawerTitle = '';
  drawerRows: TimelinessListRow[] = [];

  constructor(private timeliness: TimelinessReportService) { }

  openBucket(k: BucketKey, s: TimelinessSummary): void {
    this.drawerTitle = this.bucketLabel(k);
    this.drawerRows = s.rowsByBucket?.[k] ?? [];
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.drawerRows = [];
    this.drawerTitle = '';
  }

  private splitCsv(s: string): string[] {
    return (s ?? '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  }

  run(): void {
    this.lastRan = true;

    this.filters = {
      components: this.splitCsv(this.componentsText),
      requirementsOffices: this.splitCsv(this.requirementsOfficesText),
      fiscalYears: this.splitCsv(this.fiscalYearsText),
      startDate: this.startDate || '',
      endDate: this.endDate || '',
      creationDateAfter: this.creationDateAfter || '',
      creationDateBefore: this.creationDateBefore || '',
    };

    this.summary$ = this.timeliness.getTimelinessSummary$(this.filters);
  }

  reset(): void {
    this.componentsText = '';
    this.requirementsOfficesText = '';
    this.fiscalYearsText = '';
    this.startDate = '';
    this.endDate = '';
    this.creationDateAfter = '';
    this.creationDateBefore = '';

    this.filters = {
      components: [],
      requirementsOffices: [],
      fiscalYears: [],
      startDate: '',
      endDate: '',
      creationDateAfter: '',
      creationDateBefore: '',
    };

    this.summary$ = of(null);
    this.lastRan = false;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  bucketLabel(k: BucketKey): string {
    const labels: Record<BucketKey, string> = {
      PAST_DUE: 'Published after anticipated award date',
      DUE_0_30: 'Published 0–30 days before award date',
      DUE_31_60: 'Published 31–60 days before award date',
      DUE_61_90: 'Published 61–90 days before award date',
      DUE_91_180: 'Published 91–180 days before award date',
      DUE_181_PLUS: 'Published 181+ days before award date',
      MISSING_DATES: 'Missing award date and/or published date',
    };
    return labels[k];
  }

  bucketColor(k: BucketKey): string {
    const colors: Record<BucketKey, string> = {
      PAST_DUE: '#c73a3a',
      DUE_0_30: '#f39c12',
      DUE_31_60: '#f39c12',
      DUE_61_90: '#2aa6d8',
      DUE_91_180: '#2aa6d8',
      DUE_181_PLUS: '#2e9b3f',
      MISSING_DATES: '#6b7280',
    };
    return colors[k];
  }

  downloadCsv(s: TimelinessSummary): void {
    const allRows = Object.values(s.rowsByBucket ?? {}).flat();
    if (!allRows.length) return;

    const headers = [
      '4SITE Number',
      'Component',
      'Office',
      'Anticipated Award Date',
      'Published Date'
    ];

    const csvRows = [
      headers.join(','),
      ...allRows.map(r =>
        [
          r.apfsNumber,
          r.component,
          r.office,
          r.anticipatedAwardDate,
          r.publishedDate
        ]
          .map(val => `"${String(val ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '4SITE_Timeliness_Report.csv';
    link.click();
  }

  downloadExcel(s: TimelinessSummary): void {
    const allRows = Object.values(s.rowsByBucket ?? {}).flat();
    if (!allRows.length) return;

    const worksheetData = allRows.map(r => ({
      '4SITE Number': r.apfsNumber,
      'Component': r.component,
      'Office': r.office,
      'Anticipated Award Date': r.anticipatedAwardDate,
      'Published Date': r.publishedDate
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timeliness');

    XLSX.writeFile(wb, '4SITE_Timeliness_Report.xlsx');
  }

  downloadPdf(s: TimelinessSummary): void {
    const allRows = Object.values(s.rowsByBucket ?? {}).flat();
    if (!allRows.length) return;

    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text('4SITE Timeliness Report', 14, 18);

    autoTable(doc, {
      startY: 25,
      head: [[
        '4SITE Number',
        'Component',
        'Office',
        'Anticipated Award Date',
        'Published Date'
      ]],
      body: allRows.map(r => [
        r.apfsNumber,
        r.component,
        r.office,
        r.anticipatedAwardDate,
        r.publishedDate
      ]),
      styles: { fontSize: 8 }
    });

    doc.save('4SITE_Timeliness_Report.pdf');
  }
}