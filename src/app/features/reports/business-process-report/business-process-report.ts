import { Component, ChangeDetectorRef } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, NgIf, NgFor } from '@angular/common';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Router } from '@angular/router';


import {
  BusinessProcessReportService,
  BusinessProcessSummary,
  BusinessProcessFilters,
  BusinessProcessDetailRow,
  BusinessProcessSectionKey,
  BusinessProcessMetricKey,
  BusinessProcessSectionSummary
} from '../services/business-process-report.service';

import { ForecastRecord } from '../../forecast/forecast-record/models/forecast-record.model';
import { ForecastRecordService, RecordHistoryRow } from '../../forecast/forecast-record/services/forecast-record.service';

@Component({
  standalone: true,
  selector: 'app-business-process-report',
  templateUrl: './business-process-report.html',
  styleUrls: ['./business-process-report.css'],
  imports: [
    CommonModule,
    FormsModule,
    NgIf,
    NgFor,
    AsyncPipe
  ],
})
export class BusinessProcessReportComponent {
  showFilters = true;
  lastRan = false;


  recordPanelOpen = false;
  recordPanelLoading = false;
  selectedRecordId: number | null = null;
  selectedRecord: ForecastRecord | null = null;
  recordHistory: RecordHistoryRow[] = [];

  componentsText = '';
  requirementsOfficesText = '';
  contractingOfficesText = '';
  coordinatorOfficesText = '';
  fiscalYearsText = '';

  startDate = '';
  endDate = '';
  creationDateAfter = '';
  creationDateBefore = '';

  filters: BusinessProcessFilters = {
    components: [],
    requirementsOffices: [],
    contractingOffices: [],
    coordinatorOffices: [],
    fiscalYears: [],
    startDate: '',
    endDate: '',
    creationDateAfter: '',
    creationDateBefore: '',
  };

  summary$: Observable<BusinessProcessSummary | null> = of(null);

  readonly sectionKeys: readonly BusinessProcessSectionKey[] = [
    'requirements',
    'contracting',
    'coordinator',
    'published',
  ] as const;

  drawerOpen = false;
  drawerTitle = '';
  drawerRows: BusinessProcessDetailRow[] = [];
  loadingDetails = false;


  constructor(
    private businessProcess: BusinessProcessReportService,
    private forecastRecordService: ForecastRecordService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

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
      contractingOffices: this.splitCsv(this.contractingOfficesText),
      coordinatorOffices: this.splitCsv(this.coordinatorOfficesText),
      fiscalYears: this.splitCsv(this.fiscalYearsText),
      startDate: this.startDate || '',
      endDate: this.endDate || '',
      creationDateAfter: this.creationDateAfter || '',
      creationDateBefore: this.creationDateBefore || '',
    };

    this.summary$ = this.businessProcess.getSummary$(this.filters);
  }

  reset(): void {
    this.componentsText = '';
    this.requirementsOfficesText = '';
    this.contractingOfficesText = '';
    this.coordinatorOfficesText = '';
    this.fiscalYearsText = '';
    this.startDate = '';
    this.endDate = '';
    this.creationDateAfter = '';
    this.creationDateBefore = '';

    this.filters = {
      components: [],
      requirementsOffices: [],
      contractingOffices: [],
      coordinatorOffices: [],
      fiscalYears: [],
      startDate: '',
      endDate: '',
      creationDateAfter: '',
      creationDateBefore: '',
    };

    this.summary$ = of(null);
    this.lastRan = false;
    this.closeDrawer();
    this.closeRecordPanel();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.drawerTitle = '';
    this.drawerRows = [];
    this.loadingDetails = false;
  }

  openDetail(section: BusinessProcessSectionKey, metric: BusinessProcessMetricKey): void {
    this.drawerTitle = this.buildDrawerTitle(section, metric);
    this.drawerRows = [];
    this.loadingDetails = true;
    this.drawerOpen = true;

    this.cdr.detectChanges();

    this.businessProcess.getDetails$(this.filters, section, metric).subscribe({
      next: (res) => {
        console.log('DETAIL RESPONSE:', res);
        this.drawerRows = Array.isArray(res?.rows) ? res.rows : [];
        this.loadingDetails = false;
        console.log('DRAWER ROWS:', this.drawerRows);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('detail error', err);
        this.drawerRows = [];
        this.loadingDetails = false;
        this.cdr.detectChanges();

      }
    });
  }

  openRecord(row: BusinessProcessDetailRow): void {
    if (!row?.recordId) return;

    this.selectedRecordId = row.recordId;
    this.selectedRecord = null;
    this.recordHistory = [];
    this.recordPanelLoading = true;
    this.recordPanelOpen = true;
    this.cdr.detectChanges();

    this.forecastRecordService.getById(row.recordId).subscribe({
      next: (record: ForecastRecord) => {
        this.selectedRecord = record;
        this.recordPanelLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('record load error', err);
        this.selectedRecord = null;
        this.recordPanelLoading = false;
        this.cdr.detectChanges();
      }
    });

    this.forecastRecordService.getHistory(row.recordId).subscribe({
      next: (history: RecordHistoryRow[]) => {
        this.recordHistory = history ?? [];
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('record history load error', err);
        this.recordHistory = [];
        this.cdr.detectChanges();
      }
    });
  }




  closeRecordPanel(): void {
    this.recordPanelOpen = false;
    this.recordPanelLoading = false;
    this.selectedRecordId = null;
    this.selectedRecord = null;
    this.recordHistory = [];
  }

  printRecord(): void {
    window.print();
  }

  goToRecord(): void {
    const id = this.selectedRecordId ?? this.selectedRecord?.id ?? null;
    console.log('goToRecord clicked, id =', id);

    if (!id) {
      console.warn('No record id available for navigation');
      return;
    }

    this.router.navigate(['/forecast', id]).then(ok => {
      console.log('navigate result =', ok);
      if (ok) {
        this.closeRecordPanel();
      } else {
        console.warn('Navigation returned false');
      }
    }).catch(err => {
      console.error('Navigation error', err);
    });
  }

  trackByRecord(index: number, row: BusinessProcessDetailRow): number | string {
    return row.recordId ?? row.apfsNumber ?? index;
  }

  sectionLabel(key: BusinessProcessSectionKey): string {
    const labels: Record<BusinessProcessSectionKey, string> = {
      requirements: 'Requirements',
      contracting: 'Contracting',
      coordinator: 'APFS Coordinator',
      published: 'Published',
    };
    return labels[key];
  }

  metricLabel(metric: BusinessProcessMetricKey): string {
    const labels: Record<BusinessProcessMetricKey, string> = {
      approved: 'Approved',
      rejected: 'Rejected',
      current: 'Current',
      touched: 'Touched',
    };
    return labels[metric];
  }

  private buildDrawerTitle(
    section: BusinessProcessSectionKey,
    metric: BusinessProcessMetricKey
  ): string {
    const sectionText = this.sectionLabel(section);

    switch (metric) {
      case 'approved':
        return `Records Approved from ${sectionText}`;
      case 'rejected':
        return `Records Rejected from ${sectionText}`;
      case 'current':
        return `Records Currently in ${sectionText}`;
      case 'touched':
        return `Records Touched ${sectionText}`;
      default:
        return `${this.metricLabel(metric)} - ${sectionText}`;
    }
  }

  getSection(summary: BusinessProcessSummary, key: BusinessProcessSectionKey): BusinessProcessSectionSummary {
    return summary.sections[key];
  }

  downloadCsv(summary: BusinessProcessSummary): void {
    const rows = this.flattenSummaryForExport(summary);
    if (!rows.length) return;

    const headers = [
      'Section',
      'Total Approvals',
      'Average Approval Time',
      'Total Rejections',
      'Average Rejection Time',
      'Current Records',
      'Touched Records'
    ];

    const csvRows = [
      headers.join(','),
      ...rows.map(r =>
        [
          r.section,
          r.totalApprovals,
          r.avgApprovalDisplay,
          r.totalRejections,
          r.avgRejectionDisplay,
          r.currentCount,
          r.touchedCount
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
    link.download = '4SITE_Business_Process_Report.csv';
    link.click();
  }

  downloadExcel(summary: BusinessProcessSummary): void {
    const rows = this.flattenSummaryForExport(summary);
    if (!rows.length) return;

    const worksheetData = rows.map(r => ({
      'Section': r.section,
      'Total Approvals': r.totalApprovals,
      'Average Approval Time': r.avgApprovalDisplay,
      'Total Rejections': r.totalRejections,
      'Average Rejection Time': r.avgRejectionDisplay,
      'Current Records': r.currentCount,
      'Touched Records': r.touchedCount,
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Business Process');

    XLSX.writeFile(wb, '4SITE_Business_Process_Report.xlsx');
  }

  downloadPdf(summary: BusinessProcessSummary): void {
    const rows = this.flattenSummaryForExport(summary);
    if (!rows.length) return;

    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text('4SITE Business Process Report', 14, 18);

    autoTable(doc, {
      startY: 25,
      head: [[
        'Section',
        'Total Approvals',
        'Avg Approval Time',
        'Total Rejections',
        'Avg Rejection Time',
        'Current Records',
        'Touched Records'
      ]],
      body: rows.map(r => [
        r.section,
        r.totalApprovals,
        r.avgApprovalDisplay,
        r.totalRejections,
        r.avgRejectionDisplay,
        r.currentCount,
        r.touchedCount
      ]),
      styles: { fontSize: 8 }
    });

    doc.save('4SITE_Business_Process_Report.pdf');
  }

  private flattenSummaryForExport(summary: BusinessProcessSummary): Array<{
    section: string;
    totalApprovals: number;
    avgApprovalDisplay: string;
    totalRejections: number;
    avgRejectionDisplay: string;
    currentCount: number;
    touchedCount: number;
  }> {
    return this.sectionKeys.map(key => {
      const s = summary.sections[key];
      return {
        section: s.label || this.sectionLabel(key),
        totalApprovals: s.totalApprovals ?? 0,
        avgApprovalDisplay: s.avgApprovalDisplay ?? '',
        totalRejections: s.totalRejections ?? 0,
        avgRejectionDisplay: s.avgRejectionDisplay ?? '',
        currentCount: s.currentCount ?? 0,
        touchedCount: s.touchedCount ?? 0,
      };
    });
  }
}