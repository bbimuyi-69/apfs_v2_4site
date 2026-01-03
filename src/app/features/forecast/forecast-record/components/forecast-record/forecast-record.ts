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

type RailStatus = 'New' | 'Draft' | 'Requirements' | 'Contracting' | 'APFS Coordinator' | 'Submitted' | 'Unknown';

interface RailPermissions {
  canReassign: boolean;
  canSave: boolean;
  canUnassign: boolean;
  canApproveSend: boolean;
  canDelete: boolean;
}

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

  /** Record Actions rail permissions (drives left rail buttons) */
  rail: RailPermissions = {
    canReassign: false,
    canSave: false,
    canUnassign: false,
    canApproveSend: false,
    canDelete: false,
  };

  get status(): ForecastRecordStatus | null {
    return this.form?.get('status')?.value ?? null;
  }
  get isDraft(): boolean {
    return this.status === 'Draft';
  }
  get isSubmitted(): boolean {
    return this.status === 'Submitted';
  }

  /** Additional Getters for role based field access */
  get roleLabel(): string {
    return this.userProfile?.role ?? 'Unknown';
  }

  /** Show or hide the record rail based on status */
  get showRecordRail(): boolean {
    // If this is /forecast/new (no recordId yet), hide the rail.
    if (!this.recordId) return false;

    // Otherwise, fallback to workflow status logic.
    const railStatus = this.normalizeRailStatus(this.status);
    return railStatus !== 'New' && railStatus !== 'Unknown';
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
  /** End Role Based field enablement getters */

  // --- Rail convenience getters for HTML ---
  get canReassign(): boolean { return this.rail.canReassign; }
  get canSave(): boolean { return this.rail.canSave; }
  get canUnassign(): boolean { return this.rail.canUnassign; }
  get canApproveSend(): boolean { return this.rail.canApproveSend; }
  get canDelete(): boolean { return this.rail.canDelete; }

  /**
   * Normalize whatever "status" values exist today into the workflow statuses you listed.
   * This protects you while the backend/UI are evolving.
   */
  private normalizeRailStatus(raw: unknown): RailStatus {
    const s = String(raw ?? '').trim();
    if (!s) return 'Unknown';

    // exact matches you told me
    if (s === 'New') return 'New';
    if (s === 'Draft') return 'Draft';
    if (s === 'Requirements') return 'Requirements';
    if (s === 'Contracting') return 'Contracting';
    if (s === 'APFS Coordinator') return 'APFS Coordinator';

    // existing enum you already have in code
    if (s === 'Submitted') return 'Submitted';

    // tolerant matching (in case backend sends slightly different labels)
    const lower = s.toLowerCase();
    if (lower.includes('require')) return 'Requirements';
    if (lower.includes('contract')) return 'Contracting';
    if (lower.includes('coordinator')) return 'APFS Coordinator';
    if (lower.includes('draft')) return 'Draft';
    if (lower.includes('submit')) return 'Submitted';
    if (lower.includes('new')) return 'New';

    return 'Unknown';
  }

  private normalizeRailRole(): 'Requirements' | 'Contracting' | 'APFS Coordinator' | 'Admin' | 'Viewer' {
    const roleRaw = (this.userProfile?.role ?? '').trim().toLowerCase();
    if (!roleRaw) return 'Viewer';

    // map your current labels
    if (roleRaw === 'requirements') return 'Requirements';
    if (roleRaw === 'contracting office' || roleRaw === 'contracting') return 'Contracting';
    if (roleRaw === 'apfs coordinator' || roleRaw.includes('coordinator')) return 'APFS Coordinator';

    // optional: if you have admin later
    if (roleRaw === 'admin' || roleRaw.includes('admin')) return 'Admin';

    return 'Viewer';
  }

  /**
   * Until assignment exists in your model, we infer "assignedToMe" as:
   * - user is in edit mode AND their role matches the owning lane (status).
   * Later, replace this with record.assignedToUserId === user.id
   */
  private computeAssignedToMe(status: RailStatus, role: string): boolean {
    const roleNorm = role.trim().toLowerCase();

    if (!this.isEditMode) return false;

    if (status === 'Requirements') return roleNorm === 'requirements';
    if (status === 'Contracting') return roleNorm === 'contracting office' || roleNorm === 'contracting';
    if (status === 'APFS Coordinator') return roleNorm === 'apfs coordinator';

    // For New/Draft, treat as "mine" in edit mode
    if (status === 'New' || status === 'Draft') return true;

    return false;
  }

  private computeRailPermissions(): void {
    const status = this.normalizeRailStatus(this.status);
    const role = this.normalizeRailRole();
    const isAdmin = role === 'Admin';
    const isCoordinator = role === 'APFS Coordinator';

    const assignedToMe = this.computeAssignedToMe(status, this.userProfile?.role ?? '');

    const canReassign =
      (status === 'Requirements' || status === 'Contracting' || status === 'APFS Coordinator') &&
      (isCoordinator || isAdmin);

    const canSave =
      (status === 'New' ||
        status === 'Draft' ||
        status === 'Requirements' ||
        status === 'Contracting' ||
        status === 'APFS Coordinator') &&
      (assignedToMe || isCoordinator || isAdmin);

    const canUnassign =
      (status === 'Requirements' || status === 'Contracting' || status === 'APFS Coordinator') &&
      (assignedToMe || isCoordinator || isAdmin);

    // "Approve & Send" means "complete my lane and route forward"
    const canApproveSend =
      this.isEditMode &&
      (assignedToMe || isAdmin) &&
      (
        (status === 'Requirements' && role === 'Requirements') ||
        (status === 'Contracting' && role === 'Contracting') ||
        (status === 'APFS Coordinator' && role === 'APFS Coordinator') ||
        isAdmin
      );

    // Only allow delete early in lifecycle
    const canDelete =
      (status === 'New' || status === 'Draft') &&
      (assignedToMe || isAdmin);

    this.rail = { canReassign, canSave, canUnassign, canApproveSend, canDelete };
  }

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

    // Update rail flags any time access state changes
    this.computeRailPermissions();
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
    if (!this.canSave) return;

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

  /**
   * This is your current submit behavior.
   * In the rail UI, you can bind "Approve & Send" to onSubmit() for now.
   * Later we'll evolve it into workflow routing (Requirements -> Contracting -> Coordinator).
   */
  onSubmit(): void {
    if (!this.form) return;
    if (!this.canApproveSend) return;

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

  // ---- Rail button handlers (stubbed; wire as you like) ----
  onPrintableView(): void {
    window.print();
  }

  onCsvDownload(): void {
    console.warn('CSV download not wired yet');
  }

  onRecordHistory(): void {
    console.warn('Record history not wired yet');
  }

  onChangeLog(): void {
    console.warn('Change log not wired yet');
  }

  onReassign(): void {
    if (!this.canReassign) return;
    console.warn('Reassign not wired yet');
  }

  onUnassign(): void {
    if (!this.canUnassign) return;
    console.warn('Unassign not wired yet');
  }

  onDelete(): void {
    if (!this.canDelete) return;
    console.warn('Delete not wired yet');
  }
}
