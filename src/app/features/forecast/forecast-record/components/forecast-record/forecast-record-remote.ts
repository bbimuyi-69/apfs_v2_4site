// src\app\features\forecast\forecast-record\components\forecast-record\forecast-record.ts

/**
 * FORECAST RECORD QUICK LINKS
 * - Form build + always-required validators: buildForecastRecordForm (forecast-record.form.ts)
 * - Enable/disable permissions: applyForecastRecordRolePermissions (forecast-record.form.ts)
 * - Required-to-proceed list: getRoleRequiredControls (this file)
 * - Action validation: triggerValidationUI -> applyRoleRequiredValidators (this file)
 * - Workflow transitions: onApproveAndSend -> performTransition (this file)
 * - Template gates: canEditRequirementsSection / canEditContractingSection (this file + html)
 */

//#region Imports
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, of, EMPTY, map, shareReplay, tap, Observable } from 'rxjs';
import { catchError, switchMap, timeout, startWith, delay } from 'rxjs/operators';
import { ForecastWorkflowLane } from '../../models/forecast-record.enums';

import {
  buildForecastRecordForm,
  ForecastRecordFormGroup,
  applyForecastRecordRolePermissions,
  UserProfileLike,
  isCommentRequired,
  formatUsPhoneWithExt,
} from './forecast-record.form';

import { createEmptyForecastRecord } from '../../models/forecast-record.factory';
import { ForecastRecord } from '../../models/forecast-record.model';
import {
  ForecastRecordService,
  ForecastChangeLogRow
} from '../../services/forecast-record.service';

import {
  APFS_COMPETITIVE,
  APFS_CONTRACT_STATUS,
  APFS_FISCAL_YEARS,
  APFS_PROGRAM_LEVELS,
  APFS_SMALL_BUSINESS_SET_ASIDE,
  APFS_TYPE_OF_AWARD,
  APFS_YES_NO_UNKNOWN,
  US_STATES_WITH_NA,
  OptionItem,
} from '../../models/forecast-record.lookups';

import { AuthService } from '../../../../../auth/auth.service';
import { ApfsOfficeService } from '../../../../../core/services/apfs-offices.service';
import { ApfsLookupsService } from '../../../../../core/services/apfs-lookups.service';
import { ApfsOrganizationService } from '../../../../../core/services/apfs-organization.service';
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
type ChangeLogItemVM = {
  id: number | string;
  at: string;
  atIso?: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  isPublic?: boolean;
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
export function apfsResolveNextLane(from: unknown): ForecastWorkflowLane | null {
  const s = String(from ?? '').trim().toLowerCase();
  if (!s) return null;

  if (s.includes('draft')) return ForecastWorkflowLane.Requirements;
  if (s.includes('require')) return ForecastWorkflowLane.Contracting;
  if (s.includes('contract')) return ForecastWorkflowLane.APFSCoordinator;
  if (s.includes('coordinator')) return ForecastWorkflowLane.Published;
  if (s.includes('publish')) return null;

  return null;
}

/** Single source of truth for the primary forward action label (record + forward-comment can both use this). */
export function apfsPrimaryForwardActionLabel(from: unknown): 'Approve & Send' | 'Save & Publish' {
  const next = apfsResolveNextLane(from);
  return next === ForecastWorkflowLane.Published ? 'Save & Publish' : 'Approve & Send';
}

/** Shareable record link (default is view; pass mode='edit' only when you explicitly want an edit deep-link). */
export function apfsForecastSharePath(id: string | number, mode: 'view' | 'edit' = 'view'): string {
  const safe = encodeURIComponent(String(id));
  return mode === 'edit' ? `/forecast/${safe}?mode=edit` : `/forecast/${safe}`;
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
  private readonly lookups = inject(ApfsLookupsService);
  private readonly officeSvc = inject(ApfsOfficeService);
  private readonly orgService = inject(ApfsOrganizationService);

  hasSavedRecord = false;
  saveSuccessMessage = false;
  isSaving = false;
  justSaved = false;
  saveMode: 'draft' | 'record' = 'draft';

  //#endregion

  //#region Lookups
  readonly programLevels = APFS_PROGRAM_LEVELS;
  readonly smallBusinessSetAsideOptions = APFS_SMALL_BUSINESS_SET_ASIDE;

  // DB-backed, loaded at runtime
  smallBusinessProgramOptions: OptionItem[] = [];
  dollarRanges: OptionItem[] = [];
  naicsCodes: OptionItem[] = [];
  contractTypes: OptionItem[] = [];
  strategicSourcingVehicleOptions: OptionItem[] = [];

  readonly yesNoUnknown = APFS_YES_NO_UNKNOWN;

  readonly competitiveOptions = APFS_COMPETITIVE;
  readonly contractStatusOptions = APFS_CONTRACT_STATUS;

  readonly fiscalYears = APFS_FISCAL_YEARS;
  readonly stateOptions = US_STATES_WITH_NA;

  /** Current user's organization id (from /me -> auth user) */
  private get myOrganizationId(): number | null {
    const u: any = (this.auth as any).user ?? (this.auth as any).session?.user ?? null;
    const raw = u?.organization_id ?? u?.organizationId ?? null;
    const n = raw != null ? Number(raw) : null;
    return Number.isFinite(n) ? n : null;
  }

  // Offices from API (loaded once, scoped by organization)
  private readonly officeOptions$ = this.officeSvc.getPublicOptions({
    active: 1,
    organizationId: this.myOrganizationId ?? undefined,
  }).pipe(shareReplay(1));

  readonly requirementsOfficeOptions$ = this.officeOptions$.pipe(
    map(rows =>
      rows
        .filter(r => r.office_assignment_permissions_level_id === 1)
        .map(r => ({
          value: String(r.id),       // ID string
          label: r.full_name,        // human readable
        }))
    )
  );

  readonly contractingOfficeOptions$ = this.officeOptions$.pipe(
    map(rows =>
      rows
        .filter(r => r.office_assignment_permissions_level_id === 2)
        .map(r => ({
          value: String(r.id),
          label: r.full_name,
        }))
    )
  );

  readonly coordinatorOfficeOptions$ = this.officeOptions$.pipe(
    map(rows =>
      rows
        .filter(r => r.office_assignment_permissions_level_id === 3)
        .map(r => ({
          value: String(r.id),
          label: r.full_name,
        }))
    )
  );

  // Section anchors for scroll-to-first-invalid
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

  // NAICS typeahead results
  filteredNaicsCodes$: Observable<OptionItem[]> = of([]);
  //#endregion

  //#region State
  form: ForecastRecordFormGroup | null = null;
  recordId: string | null = null;
  record: ForecastRecord | null = null;

  isEditMode = false;
  isLoading = true;
  loadError: string | null = null;

  private userProfile: UserProfileLike | null = null;
  submitted = false;

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
  changeLogOpen = false;
  changeLogLoading = false;
  changeLogError: string | null = null;
  changeLogRows: ForecastChangeLogRow[] = [];
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
    return d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  private formatFieldLabel(field: any): string {
    const raw = String(field ?? '').trim();
    if (!raw) return 'Unknown field';

    return raw
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  private formatChangeValue(value: any): string {
    if (value == null) return '—';

    const s = String(value).trim();
    return s || '—';
  }
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
  get changeLogItems(): ChangeLogItemVM[] {
    if (!Array.isArray(this.changeLogRows) || this.changeLogRows.length === 0) {
      return [];
    }

    return this.changeLogRows.map((r) => {
      const iso = r.date_changed ?? null;

      return {
        id: r.id ?? `${r.field_name}-${iso}`,
        at: this.formatWhen(iso),
        atIso: iso ?? undefined,
        fieldName: this.formatFieldLabel(r.field_name),
        oldValue: this.formatChangeValue(r.field_old_value),
        newValue: this.formatChangeValue(r.field_new_value),
        isPublic: Number(r.is_public) === 1,
      };
    });
  }

  //#endregion

  //#region Derived Getters (lane, role, sections, rail)
  get workflowStatus(): ForecastWorkflowLane | null {
    return this.form?.get('workflowStatus')?.value ?? null;
  }

  get isDraft(): boolean {
    return this.workflowStatus === ForecastWorkflowLane.Draft;
  }

  get isPublished(): boolean {
    return this.workflowStatus === ForecastWorkflowLane.Published;
  }

  get roleLabel(): string {
    return this.userProfile?.role ?? 'Unknown';
  }

  get showRecordRail(): boolean {
    if (!this.recordId) return false;
    const railStatus = this.normalizeRailStatus(this.workflowStatus);
    return railStatus !== 'Unknown';
  }

  private hasEditRightsFor(role: 'Requirements' | 'Contracting Office' | 'APFS Coordinator'): boolean {
    const r = (this.userProfile?.role ?? '').trim().toLowerCase();
    // Admin/Super Admin: can edit any section at any time (claim still enforced elsewhere)
    if (r === 'admin' || r.includes('admin')) return true;

    if (role === 'Requirements') return r === 'requirements';
    if (role === 'APFS Coordinator') return r === 'apfs coordinator' || r.includes('coordinator');

    return r === 'contracting' || r === 'contracting office';
  }

  private get claimedByMe(): boolean {
    const assigned = Number(this.record?.assignedToUserId ?? 0);
    const me = Number(this.userProfile?.id ?? 0);
    return assigned > 0 && assigned === me;
  }

  private get mustClaimFirst(): boolean {
    return !this.record?.assignedToUserId;
  }

  get editLockMessage(): string | null {
    if (!this.isEditMode) return null;

    if (this.mustClaimFirst) {
      return 'Claim this record to begin editing.';
    }

    if (!this.claimedByMe) {
      return `This record is currently claimed by ${this.record?.assignedToName}.`;
    }

    return null;
  }

  private get isAdminOrSuperAdmin(): boolean {
    const r = (this.userProfile?.role ?? '').trim().toLowerCase();
    const isSuperUser = this.userProfile?.isSuperuser === 1;
    return r === 'admin' || r.includes('admin') || isSuperUser;
  }

  get canEditRequirementsSection(): boolean {
    if (!this.isEditMode) return false;
    if (!this.claimedByMe) return false;

    if (this.isAdminOrSuperAdmin) return true;

    const lane = this.normalizeRailStatus(this.workflowStatus);
    if (lane === 'Draft') {
      return this.hasEditRightsFor('Requirements');
    }

    if (lane === 'Requirements') {
      return this.hasEditRightsFor('Requirements');
    }

    if (lane === 'Contracting') {
      return this.hasEditRightsFor('Contracting Office');
    }

    return false;
  }

  get canEditCoordinatorSection(): boolean {
    if (!this.isEditMode) return false;
    if (!this.claimedByMe) return false;
    if (this.isAdminOrSuperAdmin) return true;
    return this.hasEditRightsFor('APFS Coordinator');
  }

  get canEditContractingSection(): boolean {
    if (!this.isEditMode) return false;
    if (!this.claimedByMe) return false;
    if (this.isAdminOrSuperAdmin) return true;

    const lane = this.normalizeRailStatus(this.workflowStatus);
    if (lane === 'Draft') {
      return this.hasEditRightsFor('Requirements');
    }

    if (lane === 'Requirements') {
      return this.hasEditRightsFor('Requirements');
    }

    if (lane === 'Contracting') {
      return (
        this.hasEditRightsFor('Contracting Office') ||
        this.hasEditRightsFor('APFS Coordinator')
      );
    }

    return false;
  }

  get canEditClassificationSection(): boolean {
    return (
      this.isEditMode &&
      (this.canEditCoordinatorSection || this.canEditContractingSection || this.canEditRequirementsSection)
    );
  }

  get canReassign(): boolean { return this.rail.canReassign; }
  get canSave(): boolean { return this.rail.canSave; }
  get canUnassign(): boolean { return this.rail.canUnassign; }
  get canApproveSend(): boolean { return this.rail.canApproveSend; }

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
        'requirementsOfficeId',
        'contractingOfficeId',
        'coordinatorOfficeId',
        // 'requirementsOffice',
        // 'contractingOffice',
        // 'coordinatorOffice',
        'primaryContactFirstName',
        'primaryContactLastName',
        'primaryContactEmail',
        'primaryContactPhone',
        'requirementsTitle',
        'requirement',
        'dollarRange',
        'naicsCode',
        'placeOfPerformanceCity',
        'placeOfPerformanceState',
        'contractType',
        'strategicSourcingVehicleUsed',
        'strategicSourcingVehicle',
        'competitive',
        'contractStatus',
        'competitive',
        'contractStatus',
        'fiscalYear',
        'estimatedPopStart',
        'estimatedPopEnd',
        'anticipatedAwardDate',
        'estimatedSolicitationReleaseDate',
      ];
    }

    if (role === 'Contracting' && effectiveLane === 'Contracting') {
      return [
        'contractType',
        'strategicSourcingVehicleUsed',
        'strategicSourcingVehicle',
        'competitive',
        'contractStatus',
        'dollarRange',
        'naicsCode',
      ];
    }

    if (role === 'APFS Coordinator' && effectiveLane === 'APFS Coordinator') {
      return [
        'smallBusinessSetAside',
        'smallBusinessProgram',
        'sbSpecialistFirstName',
        'sbSpecialistLastName',
        'sbSpecialistPhone',
        'sbSpecialistEmail',
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

  private wireStrategicSourcingVehicleToggle(): void {
    if (!this.form) return;

    const usedCtrl = this.form.get('strategicSourcingVehicleUsed');
    const vehicleCtrl = this.form.get('strategicSourcingVehicle');

    if (!usedCtrl || !vehicleCtrl) return;

    const apply = (v: unknown) => {
      const isYes = String(v ?? '').toUpperCase() === 'YES';

      console.log('[SSV toggle] strategicSourcingVehicleUsed:', v);

      if (isYes) {
        vehicleCtrl.enable({ emitEvent: false });
      } else {
        vehicleCtrl.setValue('', { emitEvent: false });
        vehicleCtrl.disable({ emitEvent: false });
      }
    };

    apply(usedCtrl.value);
    usedCtrl.valueChanges.subscribe(apply);
  }
  //#endregion

  //#endregion

  //#region Rail / Permissions / Normalization helpers
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

  private normalizeRailRole(): 'Requirements' | 'Contracting' | 'APFS Coordinator' | 'Admin' | 'Super Admin' | 'Viewer' {
    const roleRaw = (this.userProfile?.role ?? '').trim().toLowerCase();
    if (!roleRaw) return 'Viewer';

    if (roleRaw === 'requirements') return 'Requirements';
    if (roleRaw === 'contracting office' || roleRaw === 'contracting') return 'Contracting';
    if (roleRaw === 'apfs coordinator' || roleRaw.includes('coordinator')) return 'APFS Coordinator';
    if (roleRaw === 'super admin' || roleRaw === 'superadmin' || roleRaw.includes('super admin') || this.userProfile?.isSuperuser) return 'Super Admin';
    if (roleRaw === 'admin' || roleRaw.includes('admin')) return 'Admin';

    return 'Viewer';
  }

  private computeRailPermissions(): void {
    const status = this.normalizeRailStatus(this.workflowStatus);
    const role = this.normalizeRailRole();
    const isAdmin = role === 'Admin' || role === 'Super Admin' || this.userProfile?.isSuperuser === 1;
    const isCoordinator = role === 'APFS Coordinator';
    const claimedByMe = this.claimedByMe;

    const canReassign =
      status !== 'Published' &&
      isAdmin;

    const canSave =
      status !== 'Published' &&
      this.isEditMode &&
      (status === 'Draft' ||
        status === 'Requirements' ||
        status === 'Contracting' ||
        status === 'APFS Coordinator') &&
      (claimedByMe || isAdmin || isCoordinator);

    const canUnassign =
      status !== 'Published' &&
      (status === 'Requirements' || status === 'Contracting' || status === 'APFS Coordinator') &&
      (claimedByMe || isCoordinator || isAdmin);

    const canApproveSend =
      status !== 'Published' &&
      this.isEditMode &&
      claimedByMe &&
      (
        ((status === 'Draft' || status === 'Requirements') && role === 'Requirements') ||
        (status === 'Contracting' && role === 'Contracting') ||
        (status === 'APFS Coordinator' && role === 'APFS Coordinator') ||
        isAdmin
      );

    const canDelete =
      status !== 'Published' &&
      status === 'Draft' &&
      (claimedByMe || isAdmin);

    this.rail = { canReassign, canSave, canUnassign, canApproveSend, canDelete };
  }

  private applyAccessState(): void {
    if (!this.form) return;

    if (this.isEditMode) {
      this.form.enable({ emitEvent: false });
      applyForecastRecordRolePermissions(this.form, this.userProfile, { claimedByMe: this.claimedByMe });
    } else {
      this.form.disable({ emitEvent: false });
    }

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

      let section: HTMLElement | null = null;

      for (const sel of this.SECTION_IDS) {
        const found = invalidEl.closest<HTMLElement>(sel);
        if (found) { section = found; break; }
      }

      section ??= invalidEl.closest<HTMLElement>('section.sec');

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
    // placeholder utility
  }
  //#endregion

  //#region User Profile + Hydration
  private extractUserProfileFromAuth(): UserProfileLike | null {
    const u: any = (this.auth as any).user ?? (this.auth as any).session?.user ?? null;
    if (!u) return null;

    const officeId =
      u.officeId ??
      u.office_id ??
      null;

    return {
      id: u.id ?? 0,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      email: u.email ?? '',
      role: u.role ?? 'User',
      title: u.title,
      office: u.office,
      officeId,
      component: u.component,
      employeeType: u.employeeType,
      isActive: u.active,
    };
  }

  /**
   * For NEW records:
   * - Use the authenticated user's organization_id
   * - Lookup that org via ApfsOrganizationService
   * - Patch componentId (numeric) and component (label)
   */
  private initComponentFromAuthForNewRecord(): void {
    if (!this.form) return;
    if (this.recordId) return;

    const compCtrl = this.form.get('component');
    const compIdCtrl = this.form.get('componentId');
    if (!compCtrl || !compIdCtrl) return;

    // If already set, do nothing
    if (compIdCtrl.value != null && compCtrl.value) return;

    const authUser: any = (this.auth as any).user ?? (this.auth as any).session?.user ?? null;
    const rawOrg =
      authUser?.organization_id ??
      authUser?.organizationId ??
      this.myOrganizationId;

    const orgId = rawOrg != null ? Number(rawOrg) : null;
    if (!orgId || !Number.isFinite(orgId)) {
      // Fallback: keep component label from user profile if present
      if (!compCtrl.value && this.userProfile?.component) {
        compCtrl.setValue(this.userProfile.component, { emitEvent: false });
      }
      return;
    }

    this.orgService.getOrganizations({ activeOnly: true }).subscribe({
      next: (orgs: any[]) => {
        const org = (orgs ?? []).find(o => Number((o as any).id) === orgId);
        const label =
          (org as any)?.full_name ??
          (org as any)?.acronym ??
          (org as any)?.name ??
          authUser?.organizationName ??
          authUser?.organizationAcronym ??
          this.userProfile?.component ??
          null;

        compIdCtrl.setValue(orgId, { emitEvent: false });
        if (label) {
          compCtrl.setValue(label, { emitEvent: false });
        }
      },
      error: (err) => {
        console.error('[ForecastRecord] initComponentFromAuthForNewRecord: org lookup failed', err);
        compIdCtrl.setValue(orgId, { emitEvent: false });
        if (!compCtrl.value && this.userProfile?.component) {
          compCtrl.setValue(this.userProfile.component, { emitEvent: false });
        }
      },
    });
  }

  /**
 * For EXISTING records:
 * - Use the record's componentId
 * - Lookup that org via ApfsOrganizationService
 * - Patch componentId (numeric) and component (label)
 */
  private initComponentFromRecordForExisting(): void {
    if (!this.form) return;
    if (!this.recordId) return;

    const compCtrl = this.form.get('component');
    const compIdCtrl = this.form.get('componentId');
    if (!compCtrl || !compIdCtrl) return;

    // If component already has a label, don't override
    if (compCtrl.value) return;

    const rawId =
      (this.record as any)?.componentId ??
      compIdCtrl.value;

    const orgId = rawId != null ? Number(rawId) : null;
    if (!orgId || !Number.isFinite(orgId)) return;

    this.orgService.getOrganizations({ activeOnly: true }).subscribe({
      next: (orgs: any[]) => {
        const org = (orgs ?? []).find(o => Number((o as any).id) === orgId);
        const label =
          (org as any)?.full_name ??
          (org as any)?.acronym ??
          (org as any)?.name ??
          String(orgId);

        compIdCtrl.setValue(orgId, { emitEvent: false });
        compCtrl.setValue(label, { emitEvent: false });
      },
      error: (err) => {
        console.error('[ForecastRecord] initComponentFromRecordForExisting: org lookup failed', err);
        compIdCtrl.setValue(orgId, { emitEvent: false });
        // leave compCtrl empty if we can't resolve a label
      },
    });
  }


  private lockComponentFromAuth(): void {
    if (!this.form) return;

    const compCtrl = this.form.get('component');
    const compIdCtrl = this.form.get('componentId');
    if (!compCtrl) return;

    if (!this.recordId) {
      // NEW record: derive from current user/org
      this.initComponentFromAuthForNewRecord();
    } else {
      // EXISTING record: derive from record.componentId
      this.initComponentFromRecordForExisting();
    }


    // Always keep them read-only
    compCtrl.disable({ emitEvent: false });
    if (compIdCtrl) compIdCtrl.disable({ emitEvent: false });
  }

  private hydrateOfficeFromProfile(): void {
    if (!this.form) return;

    const officeId = this.userProfile?.officeId ?? null;
    const officeName = this.userProfile?.office ?? null;

    const idCtrl = this.form.get('requirementsOfficeId');
    const labelCtrl = this.form.get('requirementsOffice');

    // If we already have ID or label set, don't override
    const hasId = !!idCtrl?.value;
    const hasLabel = !!labelCtrl?.value;

    if (!officeId && !officeName) return;

    // 1) If we have officeId from profile, use it
    if (!hasId && officeId != null) {
      idCtrl?.setValue(String(officeId), { emitEvent: false });
    }

    // 2) If no officeId but we have a name and allOffices is loaded, try to match
    if (!hasId && !officeId && officeName && this.allOffices.length) {
      const match = this.allOffices.find(
        o => o.full_name.toLowerCase() === officeName.toLowerCase()
      );
      if (match) {
        idCtrl?.setValue(String(match.id), { emitEvent: false });
      }
    }

    // 3) Always set label if we have a name and label is empty
    if (!hasLabel && officeName) {
      labelCtrl?.setValue(officeName, { emitEvent: false });
    }
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

  private filterNaics(value: string | null): OptionItem[] {
    const search = (value ?? '').toLowerCase();

    return this.naicsCodes.filter(n =>
      String(n.value ?? '').toLowerCase().includes(search) ||
      String(n.label ?? '').toLowerCase().includes(search)
    );
  }

  private wireNaicsTypeahead(): void {
    if (!this.form) return;

    const ctrl = this.form.get('naicsCode');
    if (!ctrl) return;

    this.filteredNaicsCodes$ = ctrl.valueChanges.pipe(
      startWith(ctrl.value ?? ''),
      map(v => this.filterNaics((v as any) ?? ''))
    );
  }

  openNaics = false;
  //#endregion

  //#region Claim helpers
  private claimNewRecordToCurrentUser(base: ForecastRecord): ForecastRecord {
    const meId = Number(this.userProfile?.id ?? this.currentUserId ?? 0);
    if (!meId) return base;

    const first = (this.userProfile?.firstName ?? '').trim();
    const last = (this.userProfile?.lastName ?? '').trim();
    const name = `${first} ${last}`.trim() || (this.userProfile?.email ?? '');

    return {
      ...base,
      assignedToUserId: meId,
      assignedToName: name,
      assignedAt: new Date().toISOString(),
    } as any;
  }
  //#endregion
  private allOffices: { id: number; full_name: string }[] = [];
  //#region Lifecycle
  ngOnInit(): void {
    this.userProfile = this.extractUserProfileFromAuth();

    console.log(this.userProfile);
    // initial shell (treat as a new record until route resolves)
    const initial = this.claimNewRecordToCurrentUser(createEmptyForecastRecord());
    this.record = initial;
    this.form = buildForecastRecordForm(initial);
    this.wireNaicsTypeahead();

    this.hasSavedRecord = true;
    this.submitted = false;

    this.lockComponentFromAuth();
    this.applyAccessState();
    this.wireStrategicSourcingVehicleToggle();
    this.hydratePrimaryContactFromProfile();
    this.hydrateOfficeFromProfile();
    this.isLoading = true;
    this.flushView();

    // DB-backed lookups
    this.lookups.getSmallBusinessPrograms().subscribe(list => {
      this.smallBusinessProgramOptions = [
        { value: '', label: '----------' },
        ...(list ?? []),
      ];
      this.flushView();
    });

    this.lookups.getDollarRanges().subscribe(list => {
      this.dollarRanges = [
        { value: '', label: '----------' },
        ...(list ?? []),
      ];
      this.flushView();
    });

    this.lookups.getContractTypes().subscribe(list => {
      this.contractTypes = [
        { value: '', label: '----------' },
        ...(list ?? []),
      ];
      this.flushView();
    });

    this.lookups.getContractVehicles().subscribe(list => {
      this.strategicSourcingVehicleOptions = [
        { value: '', label: '----------' },
        ...(list ?? []),
      ];
      this.flushView();
    });

    this.lookups.getNaicsCodes().subscribe(list => {
      this.naicsCodes = [
        { value: '', label: 'Select…' },
        ...(list ?? []),
      ];
      this.flushView();
    });

    this.officeOptions$.subscribe(rows => {
      this.allOffices = rows.map(r => ({ id: r.id, full_name: r.full_name }));
    });

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([params, qParams]) => {
          const idParam = params.get('id');
          const mode = qParams.get('mode');
          const wantsEdit = mode === 'edit';

          this.loadError = null;

          if (!idParam || idParam === 'new') {
            this.recordId = null;
            this.record = this.claimNewRecordToCurrentUser(createEmptyForecastRecord());
            this.isEditMode = true;

            this.isLoading = false;

            this.form = buildForecastRecordForm(this.record);
            this.wireNaicsTypeahead();

            this.submitted = false;

            this.lockComponentFromAuth();
            this.applyAccessState();
            this.wireStrategicSourcingVehicleToggle();
            this.hydratePrimaryContactFromProfile();
            this.hydrateOfficeFromProfile();
            this.flushView();

            return EMPTY;
          }

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
        this.wireNaicsTypeahead();
        this.submitted = false;

        this.lockComponentFromAuth();
        this.applyAccessState();
        this.wireStrategicSourcingVehicleToggle();
        this.hydratePrimaryContactFromProfile();
        this.hydrateOfficeFromProfile();
        this.isLoading = false;
        this.flushView();
      });
  }
  //#endregion

  selectNaics(option: { value: string; label: string }) {
    this.form?.get('naicsCode')?.setValue(option.value);
    this.openNaics = false;
  }
  onSave(): void {
    this.saveMode = this.recordId ? 'record' : 'draft';

    if (this.recordId) {
      this.onSaveRecord();
    } else {
      this.onSaveDraft();
    }
  }

  get saveButtonLabel(): string {
    if (this.isSaving) {
      return this.saveMode === 'record' ? 'Saving Record...' : 'Saving Draft...';
    }

    if (this.justSaved) {
      return this.saveMode === 'record' ? '✔ Record Saved' : '✔ Draft Saved';
    }

    return this.saveMode === 'record' ? 'Save Record' : 'Save Draft';
  }
  //#region Save / Submit
  onSaveDraft(): void {
    console.log('[onSaveDraft]', {
      recordId: this.recordId,
      willCall: this.recordId ? 'update' : 'create-path',
    });

    console.log('[onSaveDraft] ENTER', { recordId: this.recordId });

    if (this.isSaving) {
      console.log('[onSaveDraft] blocked: already saving');
      return;
    }

    if (!this.form) return;
    if (!this.canSave) return;

    this.saveMode = 'draft';
    this.isSaving = true;
    this.justSaved = false;
    this.saveSuccessMessage = false;
    this.loadError = null;
    this.flushView();
    const raw = this.form.getRawValue() as any;

    // Enforce "claim" on create
    if (!this.recordId) {
      const meId = Number(this.userProfile?.id ?? this.currentUserId ?? 0);
      if (meId) {
        const first = (this.userProfile?.firstName ?? '').trim();
        const last = (this.userProfile?.lastName ?? '').trim();
        const name = `${first} ${last}`.trim() || (this.userProfile?.email ?? '');
        raw.assignedToUserId = meId;
        raw.assignedToName = name;
        raw.assignedAt = new Date().toISOString();
      }
    }

    if (!this.recordId) {
      delete raw.apfsNumber;
      delete raw.component;
    }

    const outgoingAny = this.normalizeOutgoing(
      this.recordId
        ? { ...raw, id: Number(this.recordId) }
        : raw
    );
    const payload: ForecastRecord = outgoingAny as ForecastRecord;

    const request$ = this.recordId
      ? this.service.update(payload)
      : this.service.create(payload);

    request$
      .pipe(delay(500))
      .subscribe({
        next: () => {
          this.hasSavedRecord = true;
          this.saveSuccessMessage = true;
          this.justSaved = true;
          this.isSaving = false;
          this.flushView();

          setTimeout(() => {
            this.justSaved = false;
            this.saveSuccessMessage = false;
            this.flushView();
            this.router.navigate(['/dashboard-v2']);
          }, 1200);
        },
        error: (e: unknown) => {
          console.error('Save failed', e);
          this.loadError = 'Save failed. Please try again.';
          this.isSaving = false;
          this.justSaved = false;
          this.saveSuccessMessage = false;
          this.flushView();
        },
      });
  }

  onApproveAndSend(): void {
    if (!this.form) return;
    if (!this.recordId) return;

    const fromLaneRaw = this.form.controls.workflowStatus.value;
    const toLane = this.nextLaneFromAny(fromLaneRaw);

    if (!toLane) {
      alert(`Cannot determine next lane from "${fromLaneRaw}". Check enum/string mapping.`);
      return;
    }

    if (!this.triggerValidationUI()) return;

    const raw = this.form.getRawValue() as any;

    const idNum = Number(this.recordId);
    if (!Number.isFinite(idNum)) {
      alert('Invalid record id.');
      return;
    }

    const base: ForecastRecord = this.record ?? ({ id: idNum } as ForecastRecord);

    const recordToSave: ForecastRecord = this.normalizeOutgoing({
      ...base,
      ...raw,
      id: idNum,
    }) as ForecastRecord;

    this.loadError = null;

    this.service.update(recordToSave).subscribe({
      next: () => {
        if (
          this.isLane(fromLaneRaw, ForecastWorkflowLane.Draft) &&
          this.isLane(toLane, ForecastWorkflowLane.Requirements)
        ) {
          this.performTransition(toLane);
          return;
        }

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

  get approveButtonLabel(): string {
    const fromLaneRaw = this.form?.controls.workflowStatus.value ?? this.workflowStatus;
    const next = this.nextLaneFromAny(fromLaneRaw);
    return next === ForecastWorkflowLane.Published ? 'Save & Publish' : 'Approve & Send';
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


  onSaveRecord(): void {
    if (this.isSaving) {
      console.log('[onSaveRecord] blocked: already saving');
      return;
    }
    if (!this.form) return;
    if (!this.recordId) return;
    if (!this.canSave) return;

    const idNum = Number(this.recordId);
    if (!Number.isFinite(idNum)) return;

    if (!this.triggerValidationUI()) return;
    this.saveMode = 'record';
    this.isSaving = true;
    this.justSaved = false;
    this.saveSuccessMessage = false;
    this.loadError = null;



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
    }) as ForecastRecord;

    this.isLoading = true;
    this.flushView();

    this.service.update(recordToSave).subscribe({
      next: (updated) => {
        this.record = updated;

        this.form = buildForecastRecordForm(updated);
        this.wireNaicsTypeahead();
        this.submitted = false;

        this.lockComponentFromAuth();
        this.hydrateOfficeFromProfile();
        this.applyAccessState();
        this.wireStrategicSourcingVehicleToggle();
        this.hydratePrimaryContactFromProfile();

        this.hasSavedRecord = true;
        this.saveSuccessMessage = true;
        this.justSaved = true;
        this.isSaving = false;
        this.isLoading = false;
        this.flushView();

        setTimeout(() => {
          this.justSaved = false;
          this.saveSuccessMessage = false;
          this.flushView?.();
        }, 3000);
      },
      error: (e: any) => {
        console.error('[onSaveRecord] save failed', e);
        this.loadError = e?.error?.message ?? e?.message ?? 'Save failed. Please try again.';
        this.isSaving = false;
        this.justSaved = false;
        this.saveSuccessMessage = false;
        this.isLoading = false;
        this.flushView();
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

    const raw = String(this.workflowStatus ?? '').trim();
    if (raw === 'Draft' || raw === 'Requirements') return false;

    const status: RailStatus = this.normalizeRailStatus(raw);
    const role = this.normalizeRailRole();
    const isAdmin = role === 'Admin';

    if (
      (status === 'Requirements' && role !== 'Requirements') ||
      (status === 'Contracting' && role !== 'Contracting') ||
      (status === 'APFS Coordinator' && role !== 'APFS Coordinator')
    ) {
      if (!isAdmin) return false;
    }

    if (!this.isAssignee && !isAdmin) return false;

    return true;
  }

  get canUnpublish(): boolean {
    if (!this.isEditMode) return false;
    if (!this.isPublished) return false;

    const role = this.normalizeRailRole();

    // only Admin / Super Admin
    if (role !== 'Admin' && role !== 'Super Admin') return false;

    // must be claimed (same rule as everything else)
    //if (!this.claimedByMe) return false;

    return true;
  }
  onTransition(toLane: ForecastWorkflowLane) {
    if (!this.form) return;
    if (!this.recordId) return;

    const fromLane = this.form.controls.workflowStatus.value;

    console.group('[onTransition]');
    console.log('recordId:', this.recordId);
    console.log('fromLane:', fromLane);
    console.log('toLane:', toLane);
    console.groupEnd();

    if (this.isLane(fromLane, ForecastWorkflowLane.Draft) && this.isLane(toLane, ForecastWorkflowLane.Requirements)) {
      this.performTransition(toLane);
      return;
    }

    this.router.navigate(['/forecast', this.recordId, 'forward'], {
      queryParams: { from: fromLane, to: toLane, returnTo: 'record' },
    });
  }

  /**
   * Normalize outgoing payload before calling API.
   * - Empty strings → null for selected fields
   * - Ensure componentId ↔ component_id are present and consistent
   *   (defaulting from myOrganizationId if needed)
   * - Remove the display-only "component" label so the backend uses IDs only
   */
  /**
 * Normalize outgoing payload before calling API.
 * - Empty strings → null for selected fields
 * - Ensure componentId is present (defaulting from myOrganizationId if needed)
 * - Remove the display-only "component" label so the backend uses IDs only
 */
  private normalizeOutgoing(v: any): any {
    if (v.dollarRange === '') v.dollarRange = null;
    if (v.naicsCode === '') v.naicsCode = null;

    const defaultOrgId = this.myOrganizationId;
    const hasCompId = v.componentId != null && v.componentId !== '';

    // If no componentId set on the form, default it from the current user's org
    if (!hasCompId && defaultOrgId != null) {
      v.componentId = defaultOrgId;
    }

    // We no longer send component_id at all
    if (Object.prototype.hasOwnProperty.call(v, 'component_id')) {
      delete v.component_id;
    }

    // Component is a display label only; backend uses IDs
    if (Object.prototype.hasOwnProperty.call(v, 'component')) {
      delete v.component;
    }

    return v;
  }

  private getCurrentUserForReject(): { userId: string; userDisplay: string } | null {
    const userIdNum = this.currentUserId;
    if (userIdNum == null) {
      console.warn('[ForecastRecord] Reject called without authenticated user');
      return null;
    }

    const userId = String(userIdNum);

    const first = (this.userProfile?.firstName ?? '').trim();
    const last = (this.userProfile?.lastName ?? '').trim();
    const name = `${first} ${last}`.trim();
    const email = (this.userProfile?.email ?? '').trim();

    const userDisplay = name || email || userId;

    return { userId, userDisplay };
  }

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
          this.wireNaicsTypeahead();
          this.submitted = false;

          this.lockComponentFromAuth();
          this.hydrateOfficeFromProfile();
          this.applyAccessState();
          this.wireStrategicSourcingVehicleToggle();
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
  onUnpublish(): void {
    if (!this.canUnpublish) return;
    if (!this.recordId) return;
    const user = this.getCurrentUserForReject();
    if (!user) {
      alert('Cannot unpublish: user id not available.');
      return;
    }
    const ok = confirm('Unpublish this record and send it back to 4SITE Coordinator?');
    if (!ok) return;

    this.isLoading = true;
    this.flushView();

    this.service.reject(Number(this.recordId), {
      comment: 'Unpublished',
      userId: user.userId,
      userDisplay: user.userDisplay
    }).subscribe({
      next: (resp) => {
        const updated = resp.record;

        this.record = updated;

        this.form = buildForecastRecordForm(updated);
        this.wireNaicsTypeahead();
        this.submitted = false;

        this.lockComponentFromAuth();
        this.hydrateOfficeFromProfile();

        this.applyAccessState();
        this.wireStrategicSourcingVehicleToggle();
        this.hydratePrimaryContactFromProfile();

        this.isLoading = false;
        this.flushView();
        this.router.navigate(['/dashboard-v2']);
      },
      error: (e: unknown) => {
        console.error('Unpublish failed', e);
        this.isLoading = false;
        this.flushView();
        alert('Unpublish failed. Please try again.');
      },
    });
  }  //#endregion

  //#region Navigation / Rail Handlers
  onCancel(): void {
    this.router.navigate(['/dashboard-v2']);
  }

  createNewForecastRecord(): void {
    this.router.navigate(['/forecast/new']);
  }

  onPrintableView(): void { window.print(); }
  onCsvDownload(): void { console.warn('CSV download not wired yet'); }
  onRecordHistory(): void {
    this.changeLogOpen = false;
    this.historyOpen = true;
    this.flushView();
  }

  closeHistory(): void {
    this.historyOpen = false;
    this.flushView();
  }

  onChangeLog(): void {
    if (!this.recordId) return;

    this.historyOpen = false;
    this.changeLogOpen = true;
    this.changeLogLoading = true;
    this.changeLogError = null;
    this.changeLogRows = [];
    this.flushView();

    this.service.getChangeLog(this.recordId).subscribe({
      next: (rows) => {
        this.changeLogRows = Array.isArray(rows) ? rows : [];
        this.changeLogLoading = false;
        this.flushView();
      },
      error: (e: unknown) => {
        console.error('Change log load failed', e);
        this.changeLogRows = [];
        this.changeLogError = 'Failed to load change log.';
        this.changeLogLoading = false;
        this.flushView();
      },
    });
  }

  closeChangeLog(): void {
    this.changeLogOpen = false;
    this.flushView();
  }

  closeDrawers(): void {
    this.historyOpen = false;
    this.changeLogOpen = false;
    this.flushView();
  }
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

    const meNum = this.currentUserId;
    const me = meNum != null ? String(meNum) : null;

    const assigned = this.record.assignedToUserId != null
      ? String(this.record.assignedToUserId)
      : null;

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
        this.wireNaicsTypeahead();
        this.submitted = false;

        this.lockComponentFromAuth();
        this.hydrateOfficeFromProfile();
        this.applyAccessState();
        this.wireStrategicSourcingVehicleToggle();
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
  //Field Validation Helpers like date formatting, phone formatting, etc.
  private formatMmDdYyyy(raw: string): string {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '').slice(0, 8); // MMDDYYYY

    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);

    let out = mm;
    if (digits.length >= 3) out += '/' + dd;
    if (digits.length >= 5) out += '/' + yyyy;

    return out;
  }







  onDateInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    if (!this.form) return;
    const ctrl = this.form.controls[controlName as keyof ForecastRecordFormGroup['controls']] as any;

    const before = input.value;
    const formatted = this.formatMmDdYyyy(before);

    if (formatted !== before) {
      ctrl.setValue(formatted || null, { emitEvent: false });
      input.value = formatted;
    }
  }


  onPhoneInput(event: Event, controlName: keyof ForecastRecordFormGroup['controls']) {
    const input = event.target as HTMLInputElement;
    const ctrl = this.form?.get(controlName as string) as any;

    const start = input.selectionStart ?? input.value.length;
    const before = input.value;

    const formatted = formatUsPhoneWithExt(before);

    if (formatted !== before) {
      ctrl.setValue(formatted, { emitEvent: false });
      input.value = formatted;

      // Best-effort cursor restore
      const delta = formatted.length - before.length;
      const pos = Math.max(start + delta, 0);
      input.setSelectionRange(pos, pos);
    }
  }



}
