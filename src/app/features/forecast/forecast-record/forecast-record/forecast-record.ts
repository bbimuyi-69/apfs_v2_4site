import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { buildForecastRecordForm, ForecastRecordFormGroup } from './forecast-record.form';
import { createEmptyForecastRecord } from '../models/forecast-record.factory';
import { ForecastRecord, ForecastRecordStatus } from '../models/forecast-record.model';
import { ForecastRecordService } from './forecast-record.service';

import {
  APFS_COMPETITIVE,
  APFS_CONTRACT_STATUS,
  APFS_CONTRACT_TYPES,
  APFS_DOLLAR_RANGES,
  APFS_FISCAL_YEARS,
  APFS_PROGRAM_LEVELS,
  APFS_SMALL_BUSINESS_PROGRAM,
  APFS_SMALL_BUSINESS_SET_ASIDE,
  APFS_TYPE_OF_AWARD,
  APFS_YES_NO_UNKNOWN,
  US_STATES_WITH_NA,
  OptionItem,
} from '../models/forecast-record.lookups';

@Component({
  selector: 'app-forecast-record',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forecast-record.html',
  styleUrls: ['./forecast-record.css'],
})
export class ForecastRecordComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ForecastRecordService);

  // Lookups
  readonly programLevels = APFS_PROGRAM_LEVELS;
  readonly smallBusinessSetAsideOptions = APFS_SMALL_BUSINESS_SET_ASIDE;
  readonly smallBusinessProgramOptions = APFS_SMALL_BUSINESS_PROGRAM;

  readonly dollarRanges = APFS_DOLLAR_RANGES;
  readonly contractTypes = APFS_CONTRACT_TYPES;
  readonly yesNoUnknown = APFS_YES_NO_UNKNOWN;
  readonly typeOfAwardOptions = APFS_TYPE_OF_AWARD;

  readonly competitiveOptions = APFS_COMPETITIVE;
  readonly contractStatusOptions = APFS_CONTRACT_STATUS;

  readonly fiscalYears = APFS_FISCAL_YEARS;
  readonly stateOptions = US_STATES_WITH_NA;

  trackByValue(_: number, item: OptionItem) {
    return item.value;
  }

  // Form / state
  form!: ForecastRecordFormGroup;
  recordId: number | null = null;
  isEditMode = false;
  isLoading = true;

  // getters used by template
  get status(): ForecastRecordStatus | null {
    return this.form?.get('status')?.value ?? null;
  }

  get isDraft(): boolean {
    return this.status === 'Draft';
  }

  get isSubmitted(): boolean {
    return this.status === 'Submitted';
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const idParam = params.get('id');

          // /forecast/new -> no id
          if (!idParam) {
            this.recordId = null;
            this.isEditMode = false;
            this.form = buildForecastRecordForm(createEmptyForecastRecord());
            this.isLoading = false;
            return of(null);
          }

          // /forecast/:id
          const id = Number(idParam);
          if (!Number.isFinite(id)) {
            // invalid route param; go back to dashboard
            this.router.navigate(['/dashboard']);
            return of(null);
          }

          this.recordId = id;
          this.isEditMode = true;
          this.isLoading = true;
          return this.service.getById(String(id));
        })
      )
      .subscribe({
        next: (record) => {
          if (record) {
            this.form = buildForecastRecordForm(record);
          }
          this.isLoading = false;
        },
        error: (e: unknown) => {
          console.error('Failed to load ForecastRecord', e);
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        },
      });
  }

  onSaveDraft(): void {
    if (!this.form) return;

    const payload = this.form.getRawValue() as ForecastRecord;

    // Decide create vs update by route mode (more reliable than payload.id)
    const request$ = this.isEditMode
      ? this.service.update(payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e: unknown) => console.error('Save failed', e),
    });
  }

  onSubmit(): void {
    if (!this.form) return;

    // Ensure saved first; then submit if needed
    const payload = this.form.getRawValue() as ForecastRecord;

    const save$ = this.isEditMode
      ? this.service.update(payload)
      : this.service.create(payload);

    save$.subscribe({
      next: (saved) => {
        const id = (saved as any)?.id;
        if (!id) {
          this.router.navigate(['/dashboard']);
          return;
        }

        this.service.submit(Number(id), (saved as any)?.submittedBy ?? null).subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: (e: unknown) => console.error('Submit failed', e),
        });
      },
      error: (e: unknown) => console.error('Save before submit failed', e),
    });
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  createNewForecastRecord(): void {
    this.router.navigate(['/forecast/new']);
  }

}
