import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ForecastRecordService, ForecastRecordPage } from '../forecast/forecast-record/services/forecast-record.service';
import { ForecastRecord } from '../forecast/forecast-record/models/forecast-record.model';

type SearchResultRow = {
  id: number;
  apfsNumber?: string;
  component?: string;
  requirementsTitle?: string;
  naicsCode?: string;
  estimatedDollarValue?: string;
};

type SearchFilters = {
  apfsNumber: string;
  requirementsTitle: string;
  naicsCode: string;
};

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search.html',
  styleUrls: ['./search.css'],
})
export class Search {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly forecastRecordService = inject(ForecastRecordService);
  private readonly cdr = inject(ChangeDetectorRef);

  pageTitle = 'Search APFS Records';
  showFilters = true;

  searchTerm = '';
  quickSearch = '';

  loading = false;
  error: string | null = null;

  private allResults: SearchResultRow[] = [];
  results: SearchResultRow[] = [];

  filters: SearchFilters = this.emptyFilters();

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.searchTerm = this.qp(params.get('q'));
      this.filters = {
        apfsNumber: this.qp(params.get('apfsNumber')),
        requirementsTitle: this.qp(params.get('requirementsTitle')),
        naicsCode: this.qp(params.get('naicsCode')),
      };

      this.runSearch();
    });
  }

  private qp(value: string | null): string {
    return (value ?? '').trim();
  }

  private emptyFilters(): SearchFilters {
    return {
      apfsNumber: '',
      requirementsTitle: '',
      naicsCode: '',
    };
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    this.router.navigate(['/search'], {
      queryParams: {
        q: this.searchTerm || null,
        apfsNumber: this.filters.apfsNumber || null,
        requirementsTitle: this.filters.requirementsTitle || null,
        naicsCode: this.filters.naicsCode || null,
      },
    });
  }

  clearAll(): void {
    this.searchTerm = '';
    this.quickSearch = '';
    this.filters = this.emptyFilters();

    this.router.navigate(['/search'], {
      queryParams: {},
    });
  }

  get appliedFilterChips(): string[] {
    return [
      this.searchTerm ? `Search All Fields: ${this.searchTerm}` : '',
      this.filters.apfsNumber ? `APFS Number: ${this.filters.apfsNumber}` : '',
      this.filters.requirementsTitle ? `Requirements Title: ${this.filters.requirementsTitle}` : '',
      this.filters.naicsCode ? `NAICS: ${this.filters.naicsCode}` : '',
    ].filter(Boolean);
  }

  runSearch(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.forecastRecordService.list({
      q: '',
      page: 1,
      pageSize: 100,
      assigned: 'all',
      status: 'All',
      sort: 'updatedAt:desc',
    }).subscribe({
      next: (page: any) => {
        console.log('SEARCH RESPONSE', page);
        console.log('TOTAL', page?.total);
        console.log('ITEM COUNT', page?.items?.length);
        console.log('ITEMS', page?.items ?? []);

        const rows = page?.items ?? [];

        this.allResults = rows
          .filter((r: any): r is ForecastRecord & { id: number } => typeof r.id === 'number')
          .map((r: ForecastRecord & { id: number }) => this.toSearchRow(r));

        console.log('ALL RESULTS AFTER MAP', this.allResults);

        this.applyClientFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('SEARCH ERROR', err);
        this.error = err?.message ?? 'Search failed.';
        this.allResults = [];
        this.results = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private toSearchRow(r: ForecastRecord & { id: number }): SearchResultRow {
    return {
      id: r.id,
      apfsNumber: r.apfsNumber ?? undefined,
      component: r.component ?? undefined,
      requirementsTitle: r.requirementsTitle ?? undefined,
      naicsCode: r.naicsCode ?? undefined,
      estimatedDollarValue: this.getEstimatedDollarValue(r),
    };
  }

  private getEstimatedDollarValue(r: ForecastRecord): string | undefined {
    const value =
      (r as any).estimatedDollarValue ??
      (r as any).estimatedContractValue ??
      (r as any).dollarRange;

    return value == null ? undefined : String(value);
  }

  applyClientFilters(): void {
    const searchNeedle = this.searchTerm.trim().toLowerCase();
    const quickNeedle = this.quickSearch.trim().toLowerCase();

    this.results = this.allResults.filter(r => {
      if (!this.matches(r.apfsNumber, this.filters.apfsNumber)) return false;
      if (!this.matches(r.requirementsTitle, this.filters.requirementsTitle)) return false;
      if (!this.matches(r.naicsCode, this.filters.naicsCode)) return false;

      const haystack = [
        r.apfsNumber,
        r.component,
        r.requirementsTitle,
        r.naicsCode,
        r.estimatedDollarValue,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (searchNeedle && !haystack.includes(searchNeedle)) return false;
      if (quickNeedle && !haystack.includes(quickNeedle)) return false;

      return true;
    });

    this.cdr.detectChanges();
  }

  private matches(value: string | undefined, filterValue: string): boolean {
    if (!filterValue) return true;
    return String(value ?? '').toLowerCase().includes(filterValue.toLowerCase());
  }

  onQuickSearchChange(): void {
    this.applyClientFilters();
  }

  removeChip(chip: string): void {
    if (chip.startsWith('Search All Fields:')) this.searchTerm = '';
    if (chip.startsWith('APFS Number:')) this.filters.apfsNumber = '';
    if (chip.startsWith('Requirements Title:')) this.filters.requirementsTitle = '';
    if (chip.startsWith('NAICS:')) this.filters.naicsCode = '';

    this.applyFilters();
  }
}