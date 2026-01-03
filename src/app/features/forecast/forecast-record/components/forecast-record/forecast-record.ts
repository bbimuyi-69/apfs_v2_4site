import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { catchError, switchMap, timeout } from 'rxjs/operators';

import {
  buildForecastRecordForm,
  ForecastRecordFormGroup,
  applyForecastRecordRolePermissions,
  UserProfileLike,
} from './forecast-record.form';

import { createEmptyForecastRecord } from '../../models/forecast-record.factory';
import { ForecastRecord, ForecastRecordStatus } from '../../models/forecast-record.model';
import { ForecastRecordService } from '../../services/forecast-record.service';

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
} from '../../models/forecast-record.lookups';

import { AuthService } from '../../../../../auth/auth.service';

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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);

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

  // State
  form: ForecastRecordFormGroup | null = null;
  recordId: string | null = null;
  isEditMode = false;
  isLoading = true;
  loadError: string | null = null;

  /** Cached per-load; safe to re-read anytime */
  private userProfile: UserProfileLike | null = null;

  get status(): ForecastRecordStatus | null {
    return this.form?.get('status')?.value ?? null;
  }
  get isDraft(): boolean {
    return this.status === 'Draft';
  }
  get isSubmitted(): boolean {
    return this.status === 'Submitted';
  }

  /**Additonal Getters for role based field access */
  get roleLabel(): string {
    return this.userProfile?.role ?? 'Unknown';
  }

  private hasEditRightsFor(role: 'Requirements' | 'Contracting Office' | 'APFS Coordinator'): boolean {
    return (this.userProfile?.role ?? '').trim().toLowerCase() === role.toLowerCase();
  }

  get canEditRequirementsSection(): boolean {
    return this.isEditMode && this.hasEditRightsFor('Requirements');
  }
  get canEditCoordinatorSection(): boolean {
    return this.isEditMode && this.hasEditRightsFor('APFS Coordinator');
  }
  get canEditContractingSection(): boolean {
    return this.isEditMode && this.hasEditRightsFor('Contracting Office');
  }

  // If you keep value classification shared:
  get canEditClassificationSection(): boolean {
    return this.isEditMode && (this.canEditCoordinatorSection || this.canEditContractingSection);
  }
  /**End Role Based field enebalement getters */


  /**
   * Applies:
   * 1) View/Edit mode
   * 2) Role-based restrictions (re-applied after enabling, so it always wins)
   */
  private applyAccessState(): void {
    if (!this.form) return;

    console.log('[Access] mode=', this.isEditMode, 'role=', this.userProfile?.role);

    if (this.isEditMode) {
      // Enable everything first, then re-disable the restricted fields by role.
      this.form.enable({ emitEvent: false });
      console.log('[Access] after enable: contractType disabled?', this.form.controls.contractType.disabled);
      applyForecastRecordRolePermissions(this.form, this.userProfile);
      console.log('[Access] after perms: contractType disabled?', this.form.controls.contractType.disabled);
    } else {
      // View mode: hard disable entire form.
      this.form.disable({ emitEvent: false });
    }
  }

  /** Forces UI refresh (needed in zoneless / OnPush-ish setups) */
  private flushView(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  /**
   * Keep AuthService quirks isolated to the component layer.
   * We produce a clean UserProfileLike object for the form layer.
   */
  private extractUserProfileFromAuth(): UserProfileLike | null {
    // Your AuthService exposes the logged-in user via getters:
    //   get user(): User | null
    //   get session(): AuthSession | null
    const u: any = (this.auth as any).user ?? (this.auth as any).session?.user ?? null;

    console.log('[AuthProbe] user=', u, 'session=', (this.auth as any).session);

    if (!u) return null;

    return {
      id: u.id ?? 0,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      email: u.email ?? '',
      role: u.role ?? 'User',
      title: u.title,
      office: u.office,
      component: u.component,
      employeeType: u.employeeType,
      isActive: u.isActive,
    };
  }

  ngOnInit(): void {
    // Cache user profile early (re-read later if you support switching)
    this.userProfile = this.extractUserProfileFromAuth();

    // Render a form shell immediately
    this.form = buildForecastRecordForm(createEmptyForecastRecord());
    this.applyAccessState();
    this.isLoading = true;
    this.flushView();

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([params, qParams]) => {
          const idParam = params.get('id');
          const mode = qParams.get('mode');
          const wantsEdit = mode === 'edit';

          this.loadError = null;

          console.log('[ForecastRecord] route id=', idParam, 'mode=', mode);

          // /forecast/new
          if (!idParam || idParam === 'new') {
            this.recordId = null;
            this.isEditMode = true;

            this.isLoading = false;

            this.form = buildForecastRecordForm(createEmptyForecastRecord());
            this.applyAccessState();
            this.flushView();

            return of(null);
          }

          // /forecast/:id
          this.recordId = idParam;
          this.isEditMode = wantsEdit;

          this.isLoading = true;
          this.flushView();

          console.log('[ForecastRecord] GET by id:', idParam);

          return this.service.getById(idParam).pipe(
            timeout(8000),
            catchError((err) => {
              console.error('[ForecastRecord] getById failed/hung', err);
              this.loadError =
                'Could not load this record. The API may be down, the id may not exist, or the request timed out.';
              return of(null);
            })
          );
        })
      )
      .subscribe((record) => {
        console.log('[ForecastRecord] got record:', record);

        // Re-read profile in case auth was late to populate
        this.userProfile = this.extractUserProfileFromAuth();

        this.form = buildForecastRecordForm(record ?? createEmptyForecastRecord());
        this.applyAccessState();
        this.isLoading = false;
        this.flushView();
      });
  }

  onSaveDraft(): void {
    if (!this.form) return;

    const raw = this.form.getRawValue() as any;

    // Ensure id is present for updates (form likely doesn't contain id)
    const payload: ForecastRecord = this.recordId
      ? ({ ...raw, id: Number(this.recordId) } as ForecastRecord)
      : (raw as ForecastRecord);

    const request$ = this.recordId ? this.service.update(payload) : this.service.create(payload);

    request$.subscribe({
      next: () => this.router.navigate(['/dashboard-v2']),
      error: (e: unknown) => console.error('Save failed', e),
    });
  }

  onSubmit(): void {
    if (!this.form) return;

    const raw = this.form.getRawValue() as any;

    const payload: ForecastRecord = this.recordId
      ? ({ ...raw, id: Number(this.recordId) } as ForecastRecord)
      : (raw as ForecastRecord);

    const save$ = this.recordId ? this.service.update(payload) : this.service.create(payload);

    save$.subscribe({
      next: (saved) => {
        const id = (saved as any)?.id ?? this.recordId;

        if (!id) {
          this.router.navigate(['/dashboard-v2']);
          return;
        }

        this.service.submit(Number(id), (saved as any)?.submittedBy ?? null).subscribe({
          next: () => this.router.navigate(['/dashboard-v2']),
          error: (e: unknown) => console.error('Submit failed', e),
        });
      },
      error: (e: unknown) => console.error('Save before submit failed', e),
    });
  }

  onCancel(): void {
    this.router.navigate(['/dashboard-v2']);
  }

  createNewForecastRecord(): void {
    this.router.navigate(['/forecast/new']);
  }
}
