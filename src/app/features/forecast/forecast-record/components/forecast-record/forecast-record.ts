import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, of, EMPTY } from 'rxjs';
import { catchError, switchMap, timeout } from 'rxjs/operators';

import { ForecastWorkflowLane } from '../../models/forecast-record.enums';

import {
  buildForecastRecordForm,
  ForecastRecordFormGroup,
  applyForecastRecordRolePermissions,
  UserProfileLike,
} from './forecast-record.form';

import { createEmptyForecastRecord } from '../../models/forecast-record.factory';
import { ForecastRecord } from '../../models/forecast-record.model';
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
  APFS_STRATEGIC_SOURCING_VEHICLES,
} from '../../models/forecast-record.lookups';

import { AuthService } from '../../../../../auth/auth.service';

type RailStatus =
  | 'Draft'
  | 'Requirements'
  | 'Contracting'
  | 'APFS Coordinator'
  | 'Published'
  | 'Unknown';

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
  readonly strategicSourcingVehicleOptions = APFS_STRATEGIC_SOURCING_VEHICLES;

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

  /** ✅ API record reference */
  record: ForecastRecord | null = null;

  isEditMode = false;
  isLoading = true;
  loadError: string | null = null;

  /** Cached per-load; safe to re-read anytime */
  private userProfile: UserProfileLike | null = null;

  /** Submit-driven validation UI */
  submitted = false;

  /** Record Actions rail permissions */
  rail: RailPermissions = {
    canReassign: false,
    canSave: false,
    canUnassign: false,
    canApproveSend: false,
    canDelete: false,
  };

  /** Canonical lane */
  get workflowStatus(): ForecastWorkflowLane | null {
    return this.form?.get('workflowStatus')?.value ?? null;
  }

  get isDraft(): boolean {
    return this.workflowStatus === ForecastWorkflowLane.Draft;
  }
  get isPublished(): boolean {
    return this.workflowStatus === ForecastWorkflowLane.Published;
  }

  /** Role label for UI */
  get roleLabel(): string {
    return this.userProfile?.role ?? 'Unknown';
  }

  /** Hide rail for /forecast/new */
  get showRecordRail(): boolean {
    if (!this.recordId) return false;
    const railStatus = this.normalizeRailStatus(this.workflowStatus);
    return railStatus !== 'Unknown';
  }

  private hasEditRightsFor(role: 'Requirements' | 'Contracting Office' | 'APFS Coordinator'): boolean {
    const r = (this.userProfile?.role ?? '').trim().toLowerCase();

    if (role === 'Requirements') return r === 'requirements';
    if (role === 'APFS Coordinator') return r === 'apfs coordinator' || r.includes('coordinator');

    return r === 'contracting' || r === 'contracting office';
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
  get canEditClassificationSection(): boolean {
    return this.isEditMode && (this.canEditCoordinatorSection || this.canEditContractingSection);
  }

  // --- Rail convenience getters ---
  get canReassign(): boolean { return this.rail.canReassign; }
  get canSave(): boolean { return this.rail.canSave; }
  get canUnassign(): boolean { return this.rail.canUnassign; }
  get canApproveSend(): boolean { return this.rail.canApproveSend; }

  /** Delete enablement based on API record assignment + current user */
  get canDelete(): boolean {
    if (!this.recordId) return false;
    if (this.isLoading) return false;
    if (!this.record) return false;

    const assignedToUserId =
      this.record.assignedToUserId != null ? Number(this.record.assignedToUserId) : null;

    if (assignedToUserId == null) return true;

    const me = this.currentUserId;
    return me != null && assignedToUserId === me;
  }

  // -----------------------------
  // ✅ Validation UI helpers
  // -----------------------------
  isInvalid(controlName: keyof ForecastRecordFormGroup['controls'] | string): boolean {
    if (!this.form) return false;
    const c = this.form.get(controlName as string);
    if (!c) return false;
    return c.invalid && (this.submitted || c.touched || c.dirty);
  }

  showError(controlName: keyof ForecastRecordFormGroup['controls'] | string, errorKey: string): boolean {
    if (!this.form) return false;
    const c = this.form.get(controlName as string);
    if (!c) return false;
    return this.isInvalid(controlName) && !!c.getError(errorKey);
  }

  private focusFirstInvalid(): void {
    queueMicrotask(() => {
      const el =
        document.querySelector<HTMLElement>('.is-invalid input, .is-invalid select, .is-invalid textarea') ??
        document.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid');

      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /**
   * Role-required fields for SUBMIT (the "red highlights" set).
   * Requirements fields are already required in the form; this also enforces
   * fields that are not required yet (Coordinator/Contracting + programLevel).
   */
  private getRoleRequiredControls(): Array<keyof ForecastRecordFormGroup['controls']> {
    const role = this.normalizeRailRole();
    const status = this.normalizeRailStatus(this.workflowStatus);

    // New record: Draft submit by Requirements should validate Requirements requirements.
    const effectiveLane: RailStatus =
      status === 'Draft' && role === 'Requirements' ? 'Requirements' : status;

    if (role === 'Requirements' && (effectiveLane === 'Requirements' || effectiveLane === 'Draft')) {
      return [
        'component',
        'primaryContactFirstName',
        'primaryContactLastName',
        'primaryContactEmail',
        'requirementsTitle',
        'requirement',
        'programLevel', // not required in form currently; enforced here for submit
      ];
    }

    if (role === 'Contracting' && effectiveLane === 'Contracting') {
      return [
        'contractType',
        'strategicSourcingVehicleUsed',
        'strategicSourcingVehicle',
        'typeOfAward',
        'competitive',
        'contractStatus',
      ];
    }

    if (role === 'APFS Coordinator' && effectiveLane === 'APFS Coordinator') {
      return [
        'smallBusinessSetAside',
        'smallBusinessProgram',
        'dollarRange',
        'naicsCode',
      ];
    }

    return [];
  }

  /**
   * Add Validators.required to the role-required set right before submit.
   * (Disabled controls are excluded from validation automatically.)
   */
  private applyRoleRequiredValidators(): void {
    if (!this.form) return;

    const required = new Set(this.getRoleRequiredControls());

    (Object.keys(this.form.controls) as Array<keyof ForecastRecordFormGroup['controls']>).forEach((key) => {
      const ctrl = this.form!.controls[key];

      if (required.has(key)) {
        const current = ctrl.validator ? [ctrl.validator] : [];
        ctrl.setValidators([...current, Validators.required]);
      }

      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    this.form.updateValueAndValidity({ emitEvent: false });
  }

  // -----------------------------
  // Rails / perms stuff (unchanged)
  // -----------------------------
  private normalizeRailStatus(raw: unknown): RailStatus {
    const s = String(raw ?? '').trim();
    if (!s) return 'Unknown';

    if (s === 'Draft') return 'Draft';
    if (s === 'Requirements') return 'Requirements';
    if (s === 'Contracting') return 'Contracting';
    if (s === 'APFS Coordinator') return 'APFS Coordinator';
    if (s === 'Published') return 'Published';

    const lower = s.toLowerCase();
    if (lower.includes('draft')) return 'Draft';
    if (lower.includes('require')) return 'Requirements';
    if (lower.includes('contract')) return 'Contracting';
    if (lower.includes('coordinator')) return 'APFS Coordinator';
    if (lower.includes('publish')) return 'Published';

    return 'Unknown';
  }

  private normalizeRailRole(): 'Requirements' | 'Contracting' | 'APFS Coordinator' | 'Admin' | 'Viewer' {
    const roleRaw = (this.userProfile?.role ?? '').trim().toLowerCase();
    if (!roleRaw) return 'Viewer';

    if (roleRaw === 'requirements') return 'Requirements';
    if (roleRaw === 'contracting office' || roleRaw === 'contracting') return 'Contracting';
    if (roleRaw === 'apfs coordinator' || roleRaw.includes('coordinator')) return 'APFS Coordinator';

    if (roleRaw === 'admin' || roleRaw.includes('admin')) return 'Admin';

    return 'Viewer';
  }

  private computeAssignedToMe(status: RailStatus, role: string): boolean {
    const roleNorm = role.trim().toLowerCase();

    if (!this.isEditMode) return false;

    if (status === 'Requirements') return roleNorm === 'requirements';
    if (status === 'Contracting') return roleNorm === 'contracting office' || roleNorm === 'contracting';
    if (status === 'APFS Coordinator') return roleNorm === 'apfs coordinator';

    if (status === 'Draft') return true;

    return false;
  }

  private computeRailPermissions(): void {
    const status = this.normalizeRailStatus(this.workflowStatus);
    const role = this.normalizeRailRole();
    const isAdmin = role === 'Admin';
    const isCoordinator = role === 'APFS Coordinator';

    const assignedToMe = this.computeAssignedToMe(status, this.userProfile?.role ?? '');

    const canReassign =
      status !== 'Published' &&
      (status === 'Requirements' || status === 'Contracting' || status === 'APFS Coordinator') &&
      (isCoordinator || isAdmin);

    const canSave =
      status !== 'Published' &&
      (status === 'Draft' ||
        status === 'Requirements' ||
        status === 'Contracting' ||
        status === 'APFS Coordinator') &&
      (assignedToMe || isCoordinator || isAdmin);

    const canUnassign =
      status !== 'Published' &&
      (status === 'Requirements' || status === 'Contracting' || status === 'APFS Coordinator') &&
      (assignedToMe || isCoordinator || isAdmin);

    const canApproveSend =
      status !== 'Published' &&
      this.isEditMode &&
      (assignedToMe || isAdmin) &&
      (
        ((status === 'Draft' || status === 'Requirements') && role === 'Requirements') ||
        (status === 'Contracting' && role === 'Contracting') ||
        (status === 'APFS Coordinator' && role === 'APFS Coordinator') ||
        isAdmin
      );

    const canDelete =
      status !== 'Published' &&
      (status === 'Draft') &&
      (assignedToMe || isAdmin);

    this.rail = { canReassign, canSave, canUnassign, canApproveSend, canDelete };
  }

  private applyAccessState(): void {
    if (!this.form) return;

    if (this.isEditMode) {
      this.form.enable({ emitEvent: false });
      applyForecastRecordRolePermissions(this.form, this.userProfile);
    } else {
      this.form.disable({ emitEvent: false });
    }

    this.computeRailPermissions();
  }

  private flushView(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  private extractUserProfileFromAuth(): UserProfileLike | null {
    const u: any = (this.auth as any).user ?? (this.auth as any).session?.user ?? null;
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
    this.userProfile = this.extractUserProfileFromAuth();

    // initial shell
    this.form = buildForecastRecordForm(createEmptyForecastRecord());
    this.submitted = false;
    this.applyAccessState();
    this.hydratePrimaryContactFromProfile();
    this.isLoading = true;
    this.flushView();

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([params, qParams]) => {
          const idParam = params.get('id');
          const mode = qParams.get('mode');
          const wantsEdit = mode === 'edit';

          this.loadError = null;

          // /forecast/new
          if (!idParam || idParam === 'new') {
            this.recordId = null;
            this.record = null;
            this.isEditMode = true;

            this.isLoading = false;

            this.form = buildForecastRecordForm(createEmptyForecastRecord());
            this.submitted = false;
            this.applyAccessState();
            this.hydratePrimaryContactFromProfile();
            this.flushView();

            return EMPTY;
          }

          // /forecast/:id
          this.recordId = idParam;
          this.isEditMode = wantsEdit;

          this.isLoading = true;
          this.flushView();

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
        this.record = record;

        this.userProfile = this.extractUserProfileFromAuth();

        this.form = buildForecastRecordForm(record ?? createEmptyForecastRecord());
        this.submitted = false;
        this.applyAccessState();
        this.hydratePrimaryContactFromProfile();
        this.isLoading = false;
        this.flushView();
      });
  }

  onSaveDraft(): void {
    if (!this.form) return;
    if (!this.canSave) return;

    const raw = this.form.getRawValue() as any;

    const payload: ForecastRecord = this.recordId
      ? ({ ...raw, id: Number(this.recordId) } as ForecastRecord)
      : (raw as ForecastRecord);

    const request$ = this.recordId ? this.service.update(payload) : this.service.create(payload);

    request$.subscribe({
      next: () => this.router.navigate(['/dashboard-v2']),
      error: (e: unknown) => console.error('Save failed', e),
    });
  }

  logInvalidControls(): void {
    if (!this.form) return;

    const invalid = Object.entries(this.form.controls)
      .filter(([_, c]) => c.invalid)
      .map(([name, c]) => ({
        name,
        value: (c as any).value,
        errors: c.errors,
        touched: c.touched,
        dirty: c.dirty,
      }));

    console.table(invalid);
    console.log('form errors', this.form.errors);
  }

  onSubmit(): void {
    if (!this.form) return;
    if (!this.canApproveSend) return;

    this.submitted = true;

    // ✅ Role-required enforcement happens here
    this.applyRoleRequiredValidators();

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.logInvalidControls();
      this.focusFirstInvalid();
      return;
    }

    const raw = this.form.getRawValue() as any;

    // advance lane
    const next = this.nextWorkflowStatus(this.form.controls.workflowStatus.value);
    raw.workflowStatus = next;

    const payload: ForecastRecord = this.recordId
      ? ({ ...raw, id: Number(this.recordId) } as ForecastRecord)
      : (raw as ForecastRecord);

    const save$ = this.recordId ? this.service.update(payload) : this.service.create(payload);

    save$.subscribe({
      next: () => this.router.navigate(['/dashboard-v2']),
      error: (e: unknown) => console.error('Route forward failed', e),
    });
  }





  onDelete(): void {
    if (!this.recordId) return;
    if (!this.record) return;

    const id = Number(this.recordId);
    if (!Number.isFinite(id)) return;

    const currentUserId = this.currentUserId;

    const assignedToUserId =
      this.record.assignedToUserId != null ? Number(this.record.assignedToUserId) : null;

    if (assignedToUserId != null && currentUserId != null && assignedToUserId !== currentUserId) {
      alert('This record is assigned to another user. Only the assignee can delete it.');
      return;
    }

    const force = assignedToUserId != null;

    const ok = force
      ? confirm('This record is assigned to you.\n\nForce delete? This cannot be undone.')
      : confirm('Delete this record? This cannot be undone.');

    if (!ok) return;

    this.isLoading = true;

    this.service.delete(id, { userId: currentUserId, force }).subscribe({
      next: () => this.router.navigate(['/dashboard-v2']),
      error: (e: unknown) => {
        console.error('Delete failed', e);
        this.isLoading = false;
      },
    });
  }

  private get currentUserId(): number | null {
    const id = (this.auth as any)?.session?.user?.id ?? (this.auth as any)?.user?.id ?? null;
    return id != null ? Number(id) : null;
  }

  private get assignedToUserId(): number | null {
    const v = this.record?.assignedToUserId ?? null;
    return v != null ? Number(v) : null;
  }

  get isAssignee(): boolean {
    const me = this.currentUserId;
    const assigned = this.assignedToUserId;
    if (me == null || assigned == null) return false;
    return assigned === me;
  }

  get hasAssignment(): boolean {
    return !!this.record?.assignedToUserId;
  }

  get canReject(): boolean {
    if (!this.isEditMode) return false;
    if (this.isPublished) return false;

    const status = this.normalizeRailStatus(this.workflowStatus);
    const role = this.normalizeRailRole();
    const isAdmin = role === 'Admin';

    // must be in the owning lane
    if (
      (status === 'Requirements' && role !== 'Requirements') ||
      (status === 'Contracting' && role !== 'Contracting') ||
      (status === 'APFS Coordinator' && role !== 'APFS Coordinator')
    ) {
      if (!isAdmin) return false;
    }

    // must be assigned or elevated
    if (!this.isAssignee && !isAdmin) return false;

    return true;
  }

  onReject(): void {
    if (!this.canReject) return;
    if (!this.form || !this.recordId) return;

    const current = this.form.controls.workflowStatus.value;
    const previous = this.previousWorkflowStatus(current);

    if (!previous) return;

    const ok = confirm(`Reject this record and send it back to ${previous}?`);
    if (!ok) return;

    // ✅ DO NOT update the record here anymore.
    // ✅ Go to the comment screen to collect required comment,
    // then the comment screen calls POST /reject (atomic: record + history).

    this.router.navigate(['/forecast', this.recordId, 'reject'], {
      queryParams: {
        to: previous,
        from: current,
        returnTo: 'record',
      },
    });

  }





  onCancel(): void {
    this.router.navigate(['/dashboard-v2']);
  }

  createNewForecastRecord(): void {
    this.router.navigate(['/forecast/new']);
  }

  // ---- Rail button handlers ----
  onPrintableView(): void { window.print(); }
  onCsvDownload(): void { console.warn('CSV download not wired yet'); }
  onRecordHistory(): void { console.warn('Record history not wired yet'); }
  onChangeLog(): void { console.warn('Change log not wired yet'); }

  onReassign(): void {
    if (!this.canReassign) return;
    console.warn('Reassign not wired yet');
  }

  onUnassign(): void {
    if (!this.canUnassign) return;
    if (!this.recordId) return;
    if (!this.record) return;

    const id = Number(this.recordId);
    if (!Number.isFinite(id)) return;

    const meNum = this.currentUserId;          // number | null
    const me = meNum != null ? String(meNum) : null;

    const assigned = this.record.assignedToUserId != null
      ? String(this.record.assignedToUserId)
      : null;

    // Force-unassign if assigned to someone else
    const force = !!assigned && !!me && assigned !== me;

    const ok = force
      ? confirm(`This record is assigned to ${this.record.assignedToName ?? 'another user'}.\n\nUnassign it anyway?`)
      : confirm('Unassign this record?');

    if (!ok) return;

    this.isLoading = true;
    this.flushView();

    this.service.unclaim(id, { userId: me, force }).subscribe({
      next: (updated) => {
        // ✅ keep API record reference in sync
        this.record = updated;

        // ✅ rebuild form so disabled/enabled + rail state refresh cleanly
        this.form = buildForecastRecordForm(updated);
        this.submitted = false; // reset submit UI after action
        this.applyAccessState();
        this.hydratePrimaryContactFromProfile(); // safe autofill (won't overwrite)
        this.isLoading = false;
        this.flushView();
      },
      error: (e: unknown) => {
        console.error('Unassign failed', e);
        this.isLoading = false;
        this.flushView();
        alert('Unassign failed. You may not have permission to unassign this record.');
      },
    });
  }


  private hydratePrimaryContactFromProfile(): void {
    if (!this.form) return;

    const u = this.userProfile;
    if (!u) return;

    const c = this.form.controls as any;

    const first = c.primaryContactFirstName?.value;
    const last = c.primaryContactLastName?.value;
    const email = c.primaryContactEmail?.value;

    if (!first && !last && !email) {
      this.form.patchValue(
        {
          primaryContactFirstName: u.firstName ?? '',
          primaryContactLastName: u.lastName ?? '',
          primaryContactEmail: u.email ?? '',
        },
        { emitEvent: true }
      );
    }

    this.computeRailPermissions();
  }

  private nextWorkflowStatus(cur: ForecastWorkflowLane | null): ForecastWorkflowLane {
    if (!cur || cur === ForecastWorkflowLane.Draft) return ForecastWorkflowLane.Requirements;
    if (cur === ForecastWorkflowLane.Requirements) return ForecastWorkflowLane.Contracting;
    if (cur === ForecastWorkflowLane.Contracting) return ForecastWorkflowLane.APFSCoordinator;
    if (cur === ForecastWorkflowLane.APFSCoordinator) return ForecastWorkflowLane.Published;
    return ForecastWorkflowLane.Published;
  }

  private previousWorkflowStatus(
    cur: ForecastWorkflowLane | null
  ): ForecastWorkflowLane | null {
    if (!cur) return null;
    if (cur === ForecastWorkflowLane.Requirements) return ForecastWorkflowLane.Draft;
    if (cur === ForecastWorkflowLane.Contracting) return ForecastWorkflowLane.Requirements;
    if (cur === ForecastWorkflowLane.APFSCoordinator) return ForecastWorkflowLane.Contracting;
    return null;
  }

}
