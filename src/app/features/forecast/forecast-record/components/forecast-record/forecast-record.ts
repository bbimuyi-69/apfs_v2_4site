//#region Imports
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
  isCommentRequired,
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
  APFS_NAICS_CODES,
} from '../../models/forecast-record.lookups';

import { AuthService } from '../../../../../auth/auth.service';
//#endregion

//#region Record History View Model
type RecordHistoryItemVM = {
  id: number | string;
  at: string;                 // formatted timestamp
  atIso?: string;             // original ISO (optional)
  title: string;              // “Draft → Requirements”
  actor: string;              // “HQ_Req@hq.dhs.gov”
  comment?: string;           // user_comment
  assignment?: string;        // assignment_display
  isLatest?: boolean;         // latest === 1
};

//#endregion


//#region Types
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
//#endregion

@Component({
  selector: 'app-forecast-record',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forecast-record.html',
  styleUrls: ['./forecast-record.css'],
})
export class ForecastRecordComponent {
  //#region DI / Constants
  readonly ForecastWorkflowLane = ForecastWorkflowLane;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ForecastRecordService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);

  hasSavedRecord = false; // ✅ HERE to track if we have saved at least once
  saveSuccessMessage = false;

  //#endregion

  //#region Lookups
  readonly programLevels = APFS_PROGRAM_LEVELS;
  readonly smallBusinessSetAsideOptions = APFS_SMALL_BUSINESS_SET_ASIDE;
  readonly smallBusinessProgramOptions = APFS_SMALL_BUSINESS_PROGRAM;

  readonly dollarRanges = APFS_DOLLAR_RANGES;
  readonly naicsCodes = APFS_NAICS_CODES;
  readonly contractTypes = APFS_CONTRACT_TYPES;
  readonly yesNoUnknown = APFS_YES_NO_UNKNOWN;
  readonly typeOfAwardOptions = APFS_TYPE_OF_AWARD;
  readonly strategicSourcingVehicleOptions = APFS_STRATEGIC_SOURCING_VEHICLES;

  readonly competitiveOptions = APFS_COMPETITIVE;
  readonly contractStatusOptions = APFS_CONTRACT_STATUS;

  readonly fiscalYears = APFS_FISCAL_YEARS;
  readonly stateOptions = US_STATES_WITH_NA;

  // ✅ New: Office dropdown options (simple v1)
  readonly requirementsOfficeOptions: OptionItem[] = [
    { value: 'Program Office', label: 'Program Office' },
    { value: 'Requirements Division', label: 'Requirements Division' },
    { value: 'Mission Support', label: 'Mission Support' },
  ];

  readonly contractingOfficeOptions: OptionItem[] = [
    { value: 'Procurement Office', label: 'Procurement Office' },
    { value: 'Contracting Division', label: 'Contracting Division' },
    { value: 'Acquisition Directorate', label: 'Acquisition Directorate' },
  ];

  readonly coordinatorOfficeOptions: OptionItem[] = [
    { value: 'APFS PMO', label: 'APFS PMO' },
    { value: 'Enterprise Governance', label: 'Enterprise Governance' },
    { value: 'APFS Coordination Cell', label: 'APFS Coordination Cell' },
  ];

  //Constants for sectional scrolling
  private readonly SECTION_IDS = [
    '#sec-record-info',
    '#sec-requirements',
    '#sec-small-business',
    '#sec-value-classification',
    '#sec-contracting',
    // '#sec-funding', // future
  ] as const;

  trackByValue(_: number, item: OptionItem) {
    return item.value;
  }
  //#endregion

  //#region State
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
  //#endregion

  //#region History Drawer State
  historyOpen = false;

  //#region History Drawer: View Model

  //#region History Drawer: Client-only helpers
  private stateName(stateId: any): string {
    const n = Number(stateId);
    if (n === 0) return 'Draft';
    if (n === 1) return 'Requirements';
    if (n === 2) return 'Contracting';
    if (n === 3) return 'APFS Coordinator';
    if (n === 4) return 'Published';
    return stateId == null ? '—' : String(stateId);
  }

  private formatWhen(iso: any): string {
    if (!iso) return '—';
    const d = new Date(iso);
    // compact but readable
    return d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  //#endregion



  get historyItems(): RecordHistoryItemVM[] {
    const anyRecord: any = this.record as any;

    const raw: any[] =
      anyRecord?.history ??
      anyRecord?.recordHistory ??
      anyRecord?.auditTrail ??
      [];

    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw.map((h) => {
      const iso = h.time ?? h.timestamp ?? h.createdAt ?? h.at ?? h.date ?? null;

      const from = h.previous_state_id ?? h.from ?? null;
      const to = h.new_state_id ?? h.to ?? null;

      const actor =
        h.user_display ??
        h.byName ??
        h.by ??
        h.userName ??
        h.actor ??
        'Unknown';

      const comment =
        (h.user_comment ?? h.comment ?? h.detail ?? h.notes ?? '')?.toString().trim() || undefined;

      const assignment =
        (h.assignment_display ?? h.assignedToName ?? '')?.toString().trim() || undefined;

      const isLatest = Number(h.latest) === 1;

      const hasTransition = from != null && to != null;

      const title =
        h.title ??
        h.action ??
        h.event ??
        (comment === 'Created'
          ? 'Created'
          : hasTransition
            ? `${this.stateName(from)} → ${this.stateName(to)}`
            : 'Updated');

      return {
        id: h.id ?? `${iso}-${actor}`,
        at: this.formatWhen(iso),
        atIso: iso ?? undefined,
        title: String(title),
        actor: String(actor),
        comment,
        assignment,
        isLatest,
      };
    });
  }



  //#endregion

  //#endregion


  //#region Derived Getters (lane, role, sections, rail)
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
  //#endregion

  //#region Validation UI Helpers
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

  get isApproveSendDisabled(): boolean {
    if (!this.form) return true;
    if (!this.canApproveSend) return true;

    const required = new Set(this.getRoleRequiredControls());

    for (const key of required) {
      const ctrl = this.form.controls[key];
      if (!ctrl) continue;
      if (ctrl.disabled) continue;

      const value = ctrl.value;
      if (value == null || (typeof value === 'string' && !value.trim())) {
        return true;
      }
    }

    return false;
  }

  private getRoleRequiredControls(): Array<keyof ForecastRecordFormGroup['controls']> {
    const role = this.normalizeRailRole();
    const status = this.normalizeRailStatus(this.workflowStatus);

    const effectiveLane: RailStatus =
      status === 'Draft' && role === 'Requirements' ? 'Requirements' : status;

    if (role === 'Requirements' && (effectiveLane === 'Requirements' || effectiveLane === 'Draft')) {
      return [
        'primaryContactFirstName',
        'primaryContactLastName',
        'primaryContactEmail',

        // ✅ Offices now required
        'requirementsOffice',
        'contractingOffice',
        'coordinatorOffice',

        // Value Classification now required
        'dollarRange',
        'naicsCode',

        'requirementsTitle',
        'requirement',
        'programLevel',
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

        // Value Classification now required
        'dollarRange',
        'naicsCode',
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
  //#endregion

  //#region Rail / Permissions / Normalization
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

    // ✅ Always lock component from auth after permissions toggles
    this.lockComponentFromAuth();

    this.computeRailPermissions();
  }



  //#endregion

  //#region View / UI Refresh Utilities
  private flushView(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  private scrollToFirstInvalidSection(): void {
    queueMicrotask(() => {
      const invalidEl =
        document.querySelector<HTMLElement>('.is-invalid input, .is-invalid select, .is-invalid textarea') ??
        document.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid');

      if (!invalidEl) return;

      // 1️⃣ prefer explicit known sections
      let section: HTMLElement | null = null;

      for (const sel of this.SECTION_IDS) {
        const found = invalidEl.closest<HTMLElement>(sel);
        if (found) { section = found; break; }
      }

      // 2️⃣ fallback to nearest generic section
      section ??= invalidEl.closest<HTMLElement>('section.sec');

      // 3️⃣ scroll (use your slowed scroll)
      if (section) {
        const y = section.getBoundingClientRect().top + window.scrollY - 80;
        this.smoothScrollTo(y, 900);
      } else {
        invalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      invalidEl.focus({ preventScroll: true });
    });
  }


  private smoothScrollTo(yTarget: number, duration = 700): void {
    const yStart = window.scrollY;
    const distance = yTarget - yStart;
    const startTime = performance.now();

    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOut(progress);

      window.scrollTo(0, yStart + distance * eased);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }



  private focusAfterAction(): void {
    // placeholder utility if you want to focus a known element after actions
  }
  //#endregion

  //#region User Profile + Hydration
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

  // ✅ New: always set + disable component from auth
  private lockComponentFromAuth(): void {
    if (!this.form) return;

    const ctrl = this.form.get('component');
    if (!ctrl) return;

    const comp = (this.userProfile?.component ?? null) as any;

    ctrl.setValue(comp, { emitEvent: false });
    ctrl.disable({ emitEvent: false });
  }

  // ✅ New: optional seed (does not overwrite)
  private hydrateOfficeFromProfile(): void {
    if (!this.form) return;

    const office = this.userProfile?.office ?? null;
    if (!office) return;

    const req = this.form.get('requirementsOffice');
    if (req && !req.value) req.setValue(office, { emitEvent: false });
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


  private triggerValidationUI(): boolean {
    if (!this.form) return false;

    this.submitted = true;
    this.applyRoleRequiredValidators();
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.logInvalidControls();
      this.focusFirstInvalid();
      return false;
    }

    return true;
  }

  //#endregion

  //#region Lifecycle
  ngOnInit(): void {
    this.userProfile = this.extractUserProfileFromAuth();

    // initial shell
    this.form = buildForecastRecordForm(createEmptyForecastRecord());
    this.hasSavedRecord = true;
    this.submitted = false;

    // ✅ lock component from auth (read-only)
    this.lockComponentFromAuth();

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

            // ✅ lock component from auth
            this.lockComponentFromAuth();

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

        // ✅ lock component from auth
        this.lockComponentFromAuth();

        this.applyAccessState();
        this.hydratePrimaryContactFromProfile();
        this.isLoading = false;
        this.flushView();
      });
  }
  //#endregion

  //#region Save / Submit
  onSaveDraft(): void {

    console.log('[onSaveDraft]', {
      recordId: this.recordId,
      willCall: this.recordId ? 'update' : 'create-path',
    });

    console.log('[onSaveDraft] ENTER', { recordId: this.recordId });
    if (!this.form) return;
    if (!this.canSave) return;

    const raw = this.form.getRawValue() as any;

    console.log('[onSaveDraft] after getRawValue', { recordId: this.recordId });

    // Server owns these on CREATE (and update protects them anyway)
    if (!this.recordId) {
      delete raw.apfsNumber;
      delete raw.component;
    }

    const payload: ForecastRecord = this.recordId
      ? ({ ...raw, id: Number(this.recordId) } as ForecastRecord)
      : (raw as ForecastRecord);

    console.log('[onSaveDraft] service methods', {
      hasCreate: typeof (this.service as any).create,
      hasUpdate: typeof (this.service as any).update,
      hasTransition: typeof (this.service as any).transition,
    });


    const request$ = this.recordId
      ? this.service.update(payload)
      : this.service.create(payload);

    console.log('[onSaveDraft] BEFORE request subscribe', { recordId: this.recordId });

    request$.subscribe({
      next: () => this.router.navigate(['/dashboard-v2']),
      error: (e: unknown) => console.error('Save failed', e),
    });

    this.hasSavedRecord = true;
    this.saveSuccessMessage = true;

    // optional: auto-hide after 3 seconds
    setTimeout(() => {
      this.saveSuccessMessage = false;
      this.flushView?.();
    }, 3000);


  }

  //Nav Rail on Approve & Send
  onApproveAndSend(): void {
    console.log('[onApproveAndSend]');
    if (!this.form) return;
    if (!this.recordId) return;

    const fromLaneRaw = this.form.controls.workflowStatus.value;
    const toLane = this.nextLaneFromAny(fromLaneRaw);

    if (!toLane) {
      alert(`Cannot determine next lane from "${fromLaneRaw}". Check enum/string mapping.`);
      return;
    }

    // ✅ highlights missing fields + focuses first invalid
    if (!this.triggerValidationUI()) return;

    // 2) save current form data BEFORE routing to comment screen
    const raw = this.form.getRawValue() as any;

    const idNum = Number(this.recordId);
    if (!Number.isFinite(idNum)) {
      alert('Invalid record id.');
      return;
    }

    // merge to avoid wiping fields not represented by the form
    const base: ForecastRecord = this.record ?? ({ id: idNum } as ForecastRecord);

    const recordToSave: ForecastRecord = this.normalizeOutgoing({
      ...base,
      ...raw,
      id: idNum,
    });

    this.loadError = null;

    this.service.update(recordToSave).subscribe({
      next: () => {
        // ✅ Keep your “Draft → Requirements is instant” rule
        if (
          this.isLane(fromLaneRaw, ForecastWorkflowLane.Draft) &&
          this.isLane(toLane, ForecastWorkflowLane.Requirements)
        ) {
          this.performTransition(toLane);
          return;
        }

        // ✅ otherwise route to forward/comment screen
        this.router.navigate(['/forecast', this.recordId, 'forward'], {
          queryParams: { from: fromLaneRaw, to: toLane, returnTo: 'record' },
        });
      },
      error: (e: any) => {
        console.error('[Approve & Send] save failed', e);
        this.loadError = e?.error?.message ?? e?.message ?? 'Save failed. Please try again.';
      },
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

  /**
 * DEPRECATED (UI removed):
 * Old submit handler before "Approve & Send" matched APFS behavior (validate + save + then comment).
 * Kept temporarily for reference during refactor; safe to delete once forward flow is stable.
 */
  onSubmit(): void {
    if (!this.form) return;
    if (!this.canApproveSend) return;

    this.submitted = true;
    this.applyRoleRequiredValidators();
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.logInvalidControls();
      this.focusFirstInvalid();
      return;
    }

    // existing record -> collect comment then advance
    if (this.recordId) {
      this.router.navigate(['/forecast', this.recordId, 'forward'], {
        queryParams: { returnTo: 'record' },
      });
      return;
    }

    // new record: create first, then go to forward screen
    const raw = this.form.getRawValue() as any;
    delete raw.apfsNumber;

    this.service.create(raw).subscribe({
      next: (created) => {
        this.router.navigate(['/forecast', created.id, 'forward'], {
          queryParams: { returnTo: 'record' },
        });
      },
      error: (e) => console.error('Create failed', e),
    });
  }


  onSaveRecord(): void {
    if (!this.form) return;
    if (!this.recordId) return;
    if (!this.canSave) return;

    const idNum = Number(this.recordId);
    if (!Number.isFinite(idNum)) return;

    if (!this.triggerValidationUI()) return;

    const raw = this.form.getRawValue() as any;
    const base: ForecastRecord = this.record ?? ({ id: idNum } as ForecastRecord);

    const currentLane = this.form.controls.workflowStatus.value;
    const nextLane = this.isLane(currentLane, ForecastWorkflowLane.Draft)
      ? ForecastWorkflowLane.Requirements
      : currentLane;

    const recordToSave: ForecastRecord = this.normalizeOutgoing({
      ...base,
      ...raw,
      id: idNum,
      workflowStatus: nextLane,
    });

    this.isLoading = true;
    this.flushView();

    this.service.update(recordToSave).subscribe({
      next: (updated) => {
        this.record = updated;

        // rebuild form so workflowStatus reflects server truth
        this.form = buildForecastRecordForm(updated);
        this.submitted = false;

        this.lockComponentFromAuth();
        this.hydrateOfficeFromProfile();
        this.applyAccessState();
        this.hydratePrimaryContactFromProfile();

        this.isLoading = false;
        this.flushView(); // ✅ this is the key piece for re-enabling Approve & Send
        this.hasSavedRecord = true;
        this.saveSuccessMessage = true;

        // optional: auto-hide after 3 seconds
        setTimeout(() => {
          this.saveSuccessMessage = false;
          this.flushView?.();
        }, 3000);


      },
      error: (e: any) => {
        console.error('[onSaveRecord] save failed', e);
        this.loadError = e?.error?.message ?? e?.message ?? 'Save failed. Please try again.';
        this.isLoading = false;
        this.flushView(); // ✅ also flush on error
      },
    });
  }

  //#endregion

  //#region Delete
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
  //#endregion

  //#region Assignment / Claim State
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
  //#endregion

  //#region Reject / Transition / Workflow Helpers
  private normalizeLane(raw: unknown): ForecastWorkflowLane | null {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return null;

    if (s.includes('draft')) return ForecastWorkflowLane.Draft;
    if (s.includes('require')) return ForecastWorkflowLane.Requirements;
    if (s.includes('contract')) return ForecastWorkflowLane.Contracting;
    if (s.includes('coordinator')) return ForecastWorkflowLane.APFSCoordinator;
    if (s.includes('publish')) return ForecastWorkflowLane.Published;

    return null;
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

  //this might not be needed at some point
  //this might not be needed at some point
  onTransition(toLane: ForecastWorkflowLane) {
    if (!this.form) return;
    if (!this.recordId) return;

    const fromLane = this.form.controls.workflowStatus.value;

    console.group('[onTransition]');
    console.log('recordId:', this.recordId);
    console.log('fromLane:', fromLane);
    console.log('toLane:', toLane);
    console.groupEnd();

    // ✅ HARD exemption: Draft → Requirements (no comment, no forward screen)
    if (this.isLane(fromLane, ForecastWorkflowLane.Draft) && this.isLane(toLane, ForecastWorkflowLane.Requirements)) {
      this.performTransition(toLane);
      return;
    }

    // everything else -> forward screen
    this.router.navigate(['/forecast', this.recordId, 'forward'], {
      queryParams: { from: fromLane, to: toLane, returnTo: 'record' },
    });
  }




  /** Optional: scrub/shape raw form values if needed */
  private normalizeOutgoing(v: any): any {
    // If your selects emit "" when unselected, convert to null (optional)
    if (v.dollarRange === '') v.dollarRange = null;
    if (v.naicsCode === '') v.naicsCode = null;
    return v;
  }




  /**
   * Robust next-lane resolver.
   * Works whether workflowStatus is:
   * - enum value
   * - 'Contracting'
   * - 'Contracting Office'
   * - 'APFS Coordinator'
   * - etc.
   */
  private nextLaneFromAny(from: unknown): ForecastWorkflowLane | null {
    const s = String(from ?? '').trim().toLowerCase();
    if (!s) return null;

    if (s.includes('draft')) return ForecastWorkflowLane.Requirements;
    if (s.includes('require')) return ForecastWorkflowLane.Contracting;
    if (s.includes('contract')) return ForecastWorkflowLane.APFSCoordinator;
    if (s.includes('coordinator')) return ForecastWorkflowLane.Published;
    if (s.includes('publish')) return null;

    return this.nextLaneStrict(this.normalizeLane(from));
  }


  /** Strict mapping when the value already matches the enum */
  private nextLaneStrict(from: ForecastWorkflowLane | null): ForecastWorkflowLane | null {
    switch (from) {
      case ForecastWorkflowLane.Draft:
        return ForecastWorkflowLane.Requirements;
      case ForecastWorkflowLane.Requirements:
        return ForecastWorkflowLane.Contracting;
      case ForecastWorkflowLane.Contracting:
        return ForecastWorkflowLane.APFSCoordinator;
      case ForecastWorkflowLane.APFSCoordinator:
        return ForecastWorkflowLane.Published;
      default:
        return null;
    }
  }


  /** Handles enum vs string comparisons safely */
  private isLane(value: unknown, lane: ForecastWorkflowLane): boolean {
    return String(value ?? '').trim().toLowerCase() === String(lane ?? '').trim().toLowerCase();
  }



  private performTransition(toLane: ForecastWorkflowLane): void {
    if (!this.form) return;
    if (!this.recordId) return;

    const id = Number(this.recordId);
    if (!Number.isFinite(id)) return;

    const fromLane = this.form.controls.workflowStatus.value;
    if (!fromLane) return;

    const comment = this.form.controls.transitionComment.value.trim();

    this.isLoading = true;
    this.flushView();

    this.service
      .transition(id, {
        to: toLane,
        comment: comment || null,
      })
      .subscribe({
        next: (updated) => {
          this.record = updated;

          this.form = buildForecastRecordForm(updated);
          this.submitted = false;

          this.lockComponentFromAuth();
          this.hydrateOfficeFromProfile();

          this.applyAccessState();
          this.hydratePrimaryContactFromProfile();

          this.form.controls.transitionComment.setValue('', { emitEvent: false });

          this.isLoading = false;
          this.flushView();
        },
        error: (e: unknown) => {
          console.error('Transition failed', e);
          this.isLoading = false;
          this.flushView();
          alert('Transition failed. Please try again.');
        },
      });
  }

  onReject(): void {
    if (!this.canReject) return;
    if (!this.form || !this.recordId) return;

    const current = this.form.controls.workflowStatus.value;
    const previous = this.previousWorkflowStatus(current);

    if (!previous) return;

    const ok = confirm(`Reject this record and send it back to ${previous}?`);
    if (!ok) return;

    this.router.navigate(['/forecast', this.recordId, 'reject'], {
      queryParams: {
        to: previous,
        from: current,
        returnTo: 'record',
      },
    });
  }
  //#endregion

  //#region Navigation / Rail Handlers 
  onCancel(): void {
    this.router.navigate(['/dashboard-v2']);
  }

  createNewForecastRecord(): void {
    this.router.navigate(['/forecast/new']);
  }

  // ---- Rail button handlers ----
  onPrintableView(): void { window.print(); }
  onCsvDownload(): void { console.warn('CSV download not wired yet'); }
  onRecordHistory(): void {
    this.historyOpen = true;
  }
  closeHistory(): void {
    this.historyOpen = false;
  }


  onChangeLog(): void { console.warn('Change log not wired yet'); }

  onReassign(): void {
    if (!this.canReassign) return;
    console.warn('Reassign not wired yet');
  }
  //#endregion

  //#region Unassign
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
        this.record = updated;

        this.form = buildForecastRecordForm(updated);
        this.submitted = false;

        this.lockComponentFromAuth();
        this.hydrateOfficeFromProfile();

        this.applyAccessState();
        this.hydratePrimaryContactFromProfile();
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
  //#endregion

  //#region Workflow Helpers
  private nextWorkflowStatus(cur: ForecastWorkflowLane | null): ForecastWorkflowLane {
    if (!cur || cur === ForecastWorkflowLane.Draft) return ForecastWorkflowLane.Requirements;
    if (cur === ForecastWorkflowLane.Requirements) return ForecastWorkflowLane.Contracting;
    if (cur === ForecastWorkflowLane.Contracting) return ForecastWorkflowLane.APFSCoordinator;
    if (cur === ForecastWorkflowLane.APFSCoordinator) return ForecastWorkflowLane.Published;
    return ForecastWorkflowLane.Published;
  }

  private previousWorkflowStatus(cur: ForecastWorkflowLane | null): ForecastWorkflowLane | null {
    if (!cur) return null;
    if (cur === ForecastWorkflowLane.Requirements) return ForecastWorkflowLane.Draft;
    if (cur === ForecastWorkflowLane.Contracting) return ForecastWorkflowLane.Requirements;
    if (cur === ForecastWorkflowLane.APFSCoordinator) return ForecastWorkflowLane.Contracting;
    return null;
  }
  //#endregion
}
