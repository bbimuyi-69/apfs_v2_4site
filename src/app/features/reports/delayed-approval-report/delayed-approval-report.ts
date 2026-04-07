import { Component } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CommonModule, AsyncPipe, NgIf, NgFor, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DelayedApprovalReportService,
  DelayedApprovalFilters,
  DelayedApprovalSummary,
  DelayedApprovalRow
} from '../services/delayed-approval-report.service';
import {
  ForecastRecordService
} from '../../forecast/forecast-record/services/forecast-record.service';

@Component({
  standalone: true,
  selector: 'app-delayed-approval-report',
  templateUrl: './delayed-approval-report.html',
  styleUrls: ['./delayed-approval-report.css'],
  imports: [
    CommonModule,
    FormsModule,
    NgIf,
    NgFor,
    AsyncPipe,
    DatePipe
  ]
})
export class DelayedApprovalReport {
  showFilters = true;
  lastRan = false;

  componentsText = '';
  statusesText = 'Requirements, Contracting, APFS Coordinator';
  fiscalYearsText = '';
  daysDelayed = 10;
  creationDateAfter = '';
  creationDateBefore = '';

  filters: DelayedApprovalFilters = {
    components: [],
    statuses: ['Requirements', 'Contracting', 'APFS Coordinator'],
    fiscalYears: [],
    daysDelayed: 10,
    creationDateAfter: '',
    creationDateBefore: ''
  };

  summary$: Observable<DelayedApprovalSummary | null> = of(null);

  constructor(
    private delayedApproval: DelayedApprovalReportService,
    private forecastRecordService: ForecastRecordService
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
      statuses: this.splitCsv(this.statusesText),
      fiscalYears: this.splitCsv(this.fiscalYearsText),
      daysDelayed: Number(this.daysDelayed || 10),
      creationDateAfter: this.creationDateAfter || '',
      creationDateBefore: this.creationDateBefore || ''
    };

    this.summary$ = this.delayedApproval.getDelayedApprovalSummary$(this.filters);
  }

  reset(): void {
    this.componentsText = '';
    this.statusesText = 'Requirements, Contracting, APFS Coordinator';
    this.fiscalYearsText = '';
    this.daysDelayed = 10;
    this.creationDateAfter = '';
    this.creationDateBefore = '';

    this.filters = {
      components: [],
      statuses: ['Requirements', 'Contracting', 'APFS Coordinator'],
      fiscalYears: [],
      daysDelayed: 10,
      creationDateAfter: '',
      creationDateBefore: ''
    };

    this.summary$ = of(null);
    this.lastRan = false;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  trackById(_: number, row: DelayedApprovalRow): number | string {
    return row.recordId ?? row.apfsNumber;
  }

  openRecord(id: string | number): void {
    if (!id) return;

    this.forecastRecordService.getById(Number(id)).subscribe((record: any) => {
      if (!record) {
        console.error('No record returned for print');
        return;
      }

      const r: any = record;
      const history = Array.isArray(record?.['history']) ? record['history'] : [];

      const esc = (v: any): string =>
        String(v ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const formatDate = (v: any): string => {
        if (!v) return '';
        const d = new Date(v);
        return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
      };

      const toStateName = (v: any): string => {
        const s = String(v ?? '').trim();
        if (!s) return '';
        if (s === '0') return 'Draft';
        if (s === '1') return 'Requirements';
        if (s === '2') return 'Contracting';
        if (s === '3') return 'APFS Coordinator';
        if (s === '4') return 'Published';
        return s;
      };

      const publishedHistory = [...history]
        .filter((x: any) =>
          String(x?.toState || x?.new_state_id || '').toLowerCase() === 'published' ||
          Number(x?.new_state_id) === 4
        )
        .sort(
          (a: any, b: any) =>
            new Date(b?.atIso || b?.at || b?.time || 0).getTime() -
            new Date(a?.atIso || a?.at || a?.time || 0).getTime()
        );

      const publishedDate =
        formatDate(r?.publishedDate) ||
        (publishedHistory[0]
          ? formatDate(publishedHistory[0].atIso || publishedHistory[0].at || publishedHistory[0].time)
          : '');

      const previouslyPublishedOn =
        publishedHistory[1]
          ? formatDate(publishedHistory[1].atIso || publishedHistory[1].at || publishedHistory[1].time)
          : '';

      const performance =
        [r?.estimatedPopStart, r?.estimatedPopEnd].filter(Boolean).join(' - ');

      const contractVehicle = r?.strategicSourcingVehicle || 'None';
      const place = [r?.placeOfPerformanceCity, r?.placeOfPerformanceState].filter(Boolean).join(', ');
      const pocName = [r?.primaryContactFirstName, r?.primaryContactLastName].filter(Boolean).join(' ');
      const coordName = [r?.sbSpecialistFirstName, r?.sbSpecialistLastName].filter(Boolean).join(' ');

      const historyRows = history.length
        ? [...history]
          .sort((a: any, b: any) => {
            const da = new Date(a?.atIso || a?.at || a?.time || 0).getTime();
            const db = new Date(b?.atIso || b?.at || b?.time || 0).getTime();
            return da - db;
          })
          .map((h: any) => {
            const rawTitle = String(h?.title || '');
            let movedFrom = '';
            let movedTo = '';

            if (rawTitle.includes('→') || rawTitle.includes('->')) {
              const arrow = rawTitle.includes('→') ? '→' : '->';
              const parts = rawTitle.split(arrow).map((x: string) => x.trim());
              movedFrom = parts[0] || '';
              movedTo = parts[1] || '';
            } else {
              movedFrom = toStateName(h?.previous_state_id);
              movedTo = toStateName(h?.new_state_id);
            }

            return `
                <tr>
                  <td>${esc(h?.at || h?.time || '')}</td>
                  <td>${esc(movedFrom)}</td>
                  <td>${esc(movedTo)}</td>
                  <td>${esc(h?.assignment || h?.assignment_display || '')}</td>
                </tr>
              `;
          })
          .join('')
        : `
          <tr>
            <td colspan="4" style="text-align:center;">No history available</td>
          </tr>
        `;

      const html = `
        <!doctype html>
        <html>
          <head>
            <title>4SITE Forecast Record Print</title>
            <style>
              @page { margin: 0.5in; }
              html, body {
                margin: 0;
                padding: 0;
                background: #fff;
                font-family: Arial, Helvetica, sans-serif;
                color: #333;
              }
              .apfs-recordprint {
                display: block;
                width: 100%;
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              .apfs-recordprint__top {
                display: grid;
                grid-template-columns: 1fr auto;
                align-items: center;
                margin-bottom: 8px;
                page-break-inside: avoid;
              }
              .apfs-recordprint__system {
                font-size: 14px;
                margin-bottom: 4px;
              }
              .apfs-recordprint__recordline {
                font-size: 14px;
              }
              .apfs-recordprint__recordline .num {
                font-size: 20px;
                margin-left: 6px;
              }
              .seal {
                width: 80px;
                margin-left: 10px;
              }
              .tbl, .hist {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
                table-layout: fixed;
              }
              .tbl td, .tbl th, .hist td, .hist th {
                border: 1px solid #dddddd;
                padding: 3px 5px;
                font-size: 11px;
                vertical-align: top;
                word-wrap: break-word;
                overflow-wrap: anywhere;
              }
              .tbl td:nth-child(1),
              .tbl th:nth-child(1),
              .tbl td:nth-child(3),
              .tbl th:nth-child(3) {
                width: 20%;
              }
              .tbl td:nth-child(2),
              .tbl th:nth-child(2),
              .tbl td:nth-child(4),
              .tbl th:nth-child(4) {
                width: 30%;
              }
              .tbl th, .hist th {
                background: #f7f7f7;
                font-weight: 600;
              }
              .tbl tr:nth-child(even),
              .hist tr:nth-child(even) {
                background: #f3f3f3;
              }
              .tbl tr, .hist tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .hist-title {
                text-align: center;
                font-size: 13px;
                margin: 6px 0 4px;
                page-break-after: avoid;
              }
              .hist th {
                font-size: 10.5px;
              }
              .hist td {
                font-size: 10.5px;
                padding: 2px 4px;
              }
            </style>
          </head>
          <body>
            <div class="apfs-recordprint">
              <div class="apfs-recordprint__top">
                <div>
                  <div class="apfs-recordprint__system">
                    Forecasting System for Industry Tracking and Engagement (4SITE)
                  </div>
                  <div class="apfs-recordprint__recordline">
                    Forecast Record Number:
                    <span class="num">${esc(r?.apfsNumber)}</span>
                  </div>
                </div>

                <img class="seal" src="${window.location.origin}/assets/images/logo.svg" alt="DHS seal" />
              </div>

              <table class="tbl">
                <tr>
                  <th>Component:</th>
                  <td>${esc(r?.component)}</td>
                  <th>Published Date:</th>
                  <td>${esc(publishedDate)}</td>
                </tr>
                <tr>
                  <th>Requirements Office:</th>
                  <td>${esc(r?.requirementsOffice)}</td>
                  <th>Previously Published On:</th>
                  <td>${esc(previouslyPublishedOn)}</td>
                </tr>
                <tr>
                  <th>Contracting Office:</th>
                  <td>${esc(r?.contractingOffice)}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <th>4SITE Coordinator Office:</th>
                  <td>${esc(r?.coordinatorOffice)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </table>

              <table class="tbl">
                <tr>
                  <td><b>NAICS:</b></td>
                  <td>${esc(r?.naicsCode)}</td>
                  <td><b>Competition:</b></td>
                  <td>${esc(r?.competitive)}</td>
                </tr>
                <tr>
                  <td><b>Small Business Set-Aside:</b></td>
                  <td>${esc(r?.smallBusinessSetAside)}</td>
                  <td><b>Small Business Program:</b></td>
                  <td>${esc(r?.smallBusinessProgram)}</td>
                </tr>
                <tr>
                  <td><b>Contract Vehicle:</b></td>
                  <td>${esc(contractVehicle)}</td>
                  <td><b>Contract Type:</b></td>
                  <td>${esc(r?.contractType)}</td>
                </tr>
                <tr>
                  <td><b>Contract Complete:</b></td>
                  <td>${esc(r?.incumbent)}</td>
                  <td><b>Contract Status:</b></td>
                  <td>${esc(r?.contractStatus)}</td>
                </tr>
                <tr>
                  <td><b>Estimated Period Of Performance:</b></td>
                  <td colspan="3">${esc(performance)}</td>
                </tr>
                <tr>
                  <td><b>Estimated Solicitation Release:</b></td>
                  <td>${esc(r?.estimatedSolicitationReleaseDate)}</td>
                  <td><b>Anticipated Award Date:</b></td>
                  <td>${esc(r?.anticipatedAwardDate)}</td>
                </tr>
                <tr>
                  <td><b>Estimated Dollar Range:</b></td>
                  <td>${esc(r?.dollarRange)}</td>
                  <td><b>Fiscal Year:</b></td>
                  <td>${esc(r?.fiscalYear)}</td>
                </tr>
                <tr>
                  <td><b>Requirements Title:</b></td>
                  <td colspan="3">${esc(r?.requirementsTitle)}</td>
                </tr>
                <tr>
                  <td><b>Description:</b></td>
                  <td colspan="3">${esc(r?.requirement)}</td>
                </tr>
                <tr>
                  <td><b>Place of Performance:</b></td>
                  <td>${esc(place)}</td>
                  <td><b>Primary POC Name:</b></td>
                  <td>${esc(pocName)}</td>
                </tr>
                <tr>
                  <td><b>Primary POC Phone:</b></td>
                  <td>${esc(r?.primaryContactPhone)}</td>
                  <td><b>Primary POC Email:</b></td>
                  <td>${esc(r?.primaryContactEmail)}</td>
                </tr>
                <tr>
                  <td><b>Small Business Specialist/4SITE Coordinator Name:</b></td>
                  <td>${esc(coordName)}</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td><b>Small Business Specialist/4SITE Coordinator Phone:</b></td>
                  <td>${esc(r?.sbSpecialistPhone)}</td>
                  <td><b>Email:</b></td>
                  <td>${esc(r?.sbSpecialistEmail)}</td>
                </tr>
              </table>

              <h3 class="hist-title">Record History</h3>

              <table class="hist">
                <tr>
                  <th>Date/Time</th>
                  <th>Moved From</th>
                  <th>Moved To</th>
                  <th>Assignment</th>
                </tr>
                ${historyRows}
              </table>
            </div>
          </body>
        </html>
      `;

      const win = window.open('', '_blank', 'width=1200,height=900');
      if (!win) {
        console.error('Unable to open print window');
        return;
      }

      win.document.open();
      win.document.write(html);
      win.document.close();

      setTimeout(() => {
        win.focus();
        win.print();
        win.close();
      }, 500);
    });
  }

  downloadCsv(summary: DelayedApprovalSummary): void {
    const rows = summary.rows ?? [];
    if (!rows.length) return;

    const headers = [
      '4SITE Number',
      'Component',
      'Creation Date',
      'Status',
      'Days Awaiting Approval',
      'Assigned Office',
      'Requirements Title'
    ];

    const csvRows = [
      headers.join(','),
      ...rows.map(r =>
        [
          r.apfsNumber,
          r.component,
          r.creationDate,
          r.status,
          r.daysAwaitingApproval,
          r.assignedOffice,
          r.requirementsTitle
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
    link.download = '4SITE_Delayed_Approval_Report.csv';
    link.click();
  }

  downloadPdf(summary: DelayedApprovalSummary): void {
    const rows = summary.rows ?? [];
    if (!rows.length) return;

    const doc = new jsPDF('l', 'pt', 'letter');

    doc.setFontSize(14);
    doc.text('4SITE Delayed Approvals Report', 40, 28);

    autoTable(doc, {
      startY: 42,
      head: [[
        '4SITE Number',
        'Component',
        'Creation Date',
        'Status',
        'Days Awaiting Approval',
        'Assigned Office',
        'Requirements Title'
      ]],
      body: rows.map(r => [
        r.apfsNumber,
        r.component,
        r.creationDate,
        r.status,
        String(r.daysAwaitingApproval ?? ''),
        r.assignedOffice,
        r.requirementsTitle
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: 20
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 90 },
        2: { cellWidth: 75 },
        3: { cellWidth: 70 },
        4: { cellWidth: 85 },
        5: { cellWidth: 180 },
        6: { cellWidth: 180 }
      }
    });

    doc.save('4SITE_Delayed_Approval_Report.pdf');
  }
}