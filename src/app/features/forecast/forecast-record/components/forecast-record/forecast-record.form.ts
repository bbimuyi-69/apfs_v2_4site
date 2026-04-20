// forecast-record.form.ts (updated)

// ✅ Adds componentId (numeric) to hold organization_id while component remains display label
//    - component: string label (e.g., "DHS HQ")
//    - componentId: number | null (e.g., 71)
//
// ✅ component & componentId are system-managed and always disabled
// ✅ Everything else unchanged

import {
    AbstractControl,
    FormControl,
    FormGroup,
    ValidationErrors,
    Validators,
    ValidatorFn
} from '@angular/forms';

import { ForecastRecord } from '../../models/forecast-record.model';
import { ForecastWorkflowLane } from '../../models/forecast-record.enums';
import { ApfsOfficeService } from 'src/app/core/services/apfs-offices.service';
import { recompeteRequiresIncumbentAndContractNumberValidator }
    from './forecast-record';

/** --- Comment required rule: all transitions except Draft → Requirements --- */
type Transition = { from: ForecastWorkflowLane; to: ForecastWorkflowLane };

const COMMENT_NOT_REQUIRED: Transition[] = [
    { from: ForecastWorkflowLane.Draft, to: ForecastWorkflowLane.Requirements },
];

export function isCommentRequired(from: ForecastWorkflowLane, to: ForecastWorkflowLane): boolean {
    return !COMMENT_NOT_REQUIRED.some(t => t.from === from && t.to === to);
}

export type ForecastRecordFormGroup = FormGroup<{
    /** System / workflow */
    apfsNumber: FormControl<string | null>;

    /** ✅ Real workflow lane (keep disabled) */
    workflowStatus: FormControl<ForecastWorkflowLane>;

    /** Top section */
    /** Display label, e.g. "DHS HQ" */
    component: FormControl<string | null>;

    /** ✅ NEW: underlying organization_id (e.g. 71) */
    componentId: FormControl<number | null>;

    /** Offices (IDs) */
    requirementsOfficeId: FormControl<string | null>;
    contractingOfficeId: FormControl<string | null>;
    coordinatorOfficeId: FormControl<string | null>;

    /** ✅ NEW: office dropdowns */
    requirementsOffice: FormControl<string | null>;
    contractingOffice: FormControl<string | null>;
    coordinatorOffice: FormControl<string | null>;

    /** ✅ NEW: UI-only action field used when transitioning lanes */
    transitionComment: FormControl<string>;

    requirementsTitle: FormControl<string>;
    requirement: FormControl<string>;

    // programLevel: FormControl<string | null>;

    /** APFS Coordinator updated fields */
    smallBusinessSetAside: FormControl<string | null>;
    smallBusinessProgram: FormControl<string | null>;

    /** Value classification */
    dollarRange: FormControl<string | null>;
    naicsCode: FormControl<string | null>;

    /** Contracting Officer updated fields */
    contractType: FormControl<string | null>;
    strategicSourcingVehicleUsed: FormControl<string | null>;
    strategicSourcingVehicle: FormControl<string | null>;
    typeOfAward: FormControl<string | null>;

    competitive: FormControl<string | null>;
    contractStatus: FormControl<string | null>;

    incumbent: FormControl<string | null>;
    contractNumber: FormControl<string | null>;

    /** Dates */
    estimatedPopStart: FormControl<string | null>;
    estimatedPopEnd: FormControl<string | null>;
    fiscalYear: FormControl<number | null>;

    /** NEW Requirements-owned fiscal year helper fields */
    fiscalYearEstAward: FormControl<number | null>;
    fiscalYearSolicitation: FormControl<number | null>;

    anticipatedAwardDate: FormControl<string | null>;
    estimatedSolicitationReleaseDate: FormControl<string | null>;

    /** Place of performance */
    placeOfPerformanceCity: FormControl<string | null>;
    placeOfPerformanceState: FormControl<string[]>;
    placeOfPerformanceCountry: FormControl<string[]>;

    /** Primary POC */
    primaryContactFirstName: FormControl<string>;
    primaryContactLastName: FormControl<string>;
    primaryContactPhone: FormControl<string | null>;
    primaryContactEmail: FormControl<string>;

    /** Alternate POC */
    alternateContactFirstName: FormControl<string | null>;
    alternateContactLastName: FormControl<string | null>;
    alternateContactPhone: FormControl<string | null>;
    alternateContactEmail: FormControl<string | null>;

    /** Small Business Specialist / Coordinator */
    sbSpecialistFirstName: FormControl<string | null>;
    sbSpecialistLastName: FormControl<string | null>;
    sbSpecialistPhone: FormControl<string | null>;
    sbSpecialistEmail: FormControl<string | null>;
}>;

export type UserProfileLike = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: 'Requirements' | 'Contracting Office' | 'APFS Coordinator' | string;
    title?: string;
    office?: string;
    officeId?: number | null;
    component?: string;
    employeeType?: string;
    isActive?: boolean;
    isSuperuser?: number;
};

type ForecastRecordWithOffices = ForecastRecord & {
    requirementsOffice?: string | null;
    contractingOffice?: string | null;
    coordinatorOffice?: string | null;
    // ID fields from ForecastRecordDto
    requirementsOfficeId?: string | null;
    contractingOfficeId?: string | null;
    coordinatorOfficeId?: string | null;
    workflowStatus?: ForecastWorkflowLane; // if your model already has it, great
    status?: any; // legacy

    /** Optional: if your model already tracks org ID */
    componentId?: number | null;
    organization_id?: number | null;
};

export function buildForecastRecordForm(record: ForecastRecord): ForecastRecordFormGroup {
    const r = record as ForecastRecordWithOffices;

    // ✅ Canonical lane value. Prefer workflowStatus; fall back to legacy status.
    const lane: ForecastWorkflowLane =
        (r.workflowStatus ??
            (r.status as ForecastWorkflowLane) ??
            ForecastWorkflowLane.Draft) as ForecastWorkflowLane;

    // Try to pick up an existing org ID from the record if present
    const initialComponentId =
        r.componentId ??
        r.organization_id ??
        null;

    // Prefer ID fields when present (new shape), else fall back to legacy name fields
    const initialRequirementsOfficeId =
        r.requirementsOfficeId ??
        null;

    const initialContractingOfficeId =
        r.contractingOfficeId ??
        null;

    const initialCoordinatorOfficeId =
        r.coordinatorOfficeId ??
        null;

    // For display labels, prefer the name fields, but you could also resolve from ID later if needed
    const initialRequirementsOfficeLabel = r.requirementsOffice ?? null;
    const initialContractingOfficeLabel = r.contractingOffice ?? null;
    const initialCoordinatorOfficeLabel = r.coordinatorOffice ?? null;

    const stateRaw = (r as any).placeOfPerformanceState;
    const countryRaw = (r as any).placeOfPerformanceCountry;

    //this is the main form builder with new fields added and validation as needed
    //Look here for adding new fields to the form        
    const form = new FormGroup(
        {
            /** System generated */
            apfsNumber: new FormControl({ value: record.apfsNumber ?? null, disabled: true }),

            /** ✅ Real workflow lane - keep disabled */
            workflowStatus: new FormControl({ value: lane, disabled: true }, { nonNullable: true }),

            /**
             * Editable label for display (but system will keep it disabled)
             * Example: "DHS HQ"
             */
            component: new FormControl(record.component ?? null, {
                validators: [Validators.required],
            }),

            /**
             * ✅ NEW: underlying organization_id (numeric)
             * Example: 71
             * This is what you should send in your API payload.
             */
            componentId: new FormControl(initialComponentId, {
                nonNullable: false,
            }),

            /** Offices: IDs (what we post to backend), labels (what we show) */

            requirementsOfficeId: new FormControl(initialRequirementsOfficeId),
            contractingOfficeId: new FormControl(initialContractingOfficeId),
            coordinatorOfficeId: new FormControl(initialCoordinatorOfficeId),

            requirementsOffice: new FormControl(initialRequirementsOfficeLabel),
            //         contractingOffice: new FormControl(initialContractingOfficeLabel),
            contractingOffice: new FormControl(initialContractingOfficeLabel, {
                validators: [Validators.required],
            }),
            coordinatorOffice: new FormControl(initialCoordinatorOfficeLabel),

            /** ✅ NEW: UI-only action field used during transitions */
            transitionComment: new FormControl('', { nonNullable: true }),


            /** Requirements Section Validators */
            requirementsTitle: new FormControl(record.requirementsTitle ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(255), noSpecialCharactersValidator()],
            }),

            requirement: new FormControl(record.requirement ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(600), noSpecialCharactersValidator()],
            }),

            dollarRange: new FormControl(record.dollarRange ?? '', {
                nonNullable: true,
                validators: [Validators.required],
            }),

            naicsCode: new FormControl(record.naicsCode ?? '', {
                nonNullable: true,
                validators: [Validators.required],
            }),

            competitive: new FormControl(record.competitive ?? '', {
                nonNullable: true,
                validators: [Validators.required],
            }),

            contractStatus: new FormControl(record.contractStatus ?? '', {
                nonNullable: true,
                validators: [Validators.required],
            }),

            incumbent: new FormControl(record.incumbent ?? '', {
                nonNullable: true,
                validators: [Validators.maxLength(100), noSpecialCharactersValidator()],
            }),

            contractNumber: new FormControl(record.contractNumber ?? '', {
                nonNullable: true,
            }),

            fiscalYear: new FormControl(record.fiscalYear ?? '', {
                nonNullable: true,
                validators: [Validators.required],
            }),

            fiscalYearEstAward: new FormControl((record as any).fiscalYearEstAward ?? null, {
                validators: [Validators.required],
            }),

            fiscalYearSolicitation: new FormControl((record as any).fiscalYearSolicitation ?? null, {
                validators: [Validators.required],
            }),

            //start not required for requirements after draft
            //incumbent: new FormControl(record.incumbent ?? null),
            //contractNumber: new FormControl(record.contractNumber ?? null),
            //end not required for requirements after draft

            placeOfPerformanceCity: new FormControl(record.placeOfPerformanceCity ?? '', {
                nonNullable: true,
                validators: [Validators.required],
            }),

            placeOfPerformanceState: new FormControl<string[]>(
                Array.isArray(stateRaw)
                    ? stateRaw
                    : stateRaw
                        ? String(stateRaw).split(',').map(v => v.trim()).filter(Boolean)
                        : [],
                {
                    nonNullable: true,
                    validators: [
                        (ctrl) => (ctrl.value?.length ? null : { required: true })
                    ]
                }
            ),

            placeOfPerformanceCountry: new FormControl<string[]>(
                Array.isArray(countryRaw)
                    ? countryRaw
                    : countryRaw
                        ? String(countryRaw).split(',').map(v => v.trim()).filter(Boolean)
                        : [],
                {
                    nonNullable: true,
                    validators: [
                        (ctrl) => (ctrl.value?.length ? null : { required: true })
                    ]
                }
            ),

            primaryContactFirstName: new FormControl(record.primaryContactFirstName ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(100)],
            }),
            primaryContactLastName: new FormControl(record.primaryContactLastName ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(100)],
            }),
            primaryContactPhone: new FormControl(record.primaryContactPhone ?? '', {
                nonNullable: true,
                validators: [
                    Validators.required,
                    Validators.maxLength(25),
                    Validators.pattern(/^\+?[\d\s().-]{7,25}$/),
                ],
            }),

            primaryContactEmail: new FormControl(record.primaryContactEmail ?? '', {
                nonNullable: true,
                validators: [
                    Validators.required,
                    govEmailValidator(),
                    Validators.maxLength(254)
                ],
            }),

            //start not required for requirements after draft
            alternateContactFirstName: new FormControl(record.alternateContactFirstName ?? null),
            alternateContactLastName: new FormControl(record.alternateContactLastName ?? null),
            alternateContactPhone: new FormControl(record.alternateContactPhone ?? null),
            alternateContactEmail: new FormControl(record.alternateContactEmail ?? null, {
                validators: [
                    govEmailValidator(),
                    Validators.maxLength(254)
                ],
            }),
            //end not required for requirements after draft



            /** Contracting Officer updated fields (role toggled later) */
            contractType: new FormControl(record.contractType ?? null),
            strategicSourcingVehicleUsed: new FormControl(record.strategicSourcingVehicleUsed ?? null),
            strategicSourcingVehicle: new FormControl(record.strategicSourcingVehicle ?? null),
            typeOfAward: new FormControl(record.typeOfAward ?? null),



            /** Dates (role toggled later) */
            estimatedPopStart: new FormControl(record.estimatedPopStart ?? null, {
                validators: [Validators.required,
                Validators.pattern(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/),
                ],
            }),
            estimatedPopEnd: new FormControl(record.estimatedPopEnd ?? null, {
                validators: [Validators.required,
                Validators.pattern(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/),
                ],
            }),
            estimatedSolicitationReleaseDate: new FormControl(record.estimatedSolicitationReleaseDate ?? null, {
                validators: [Validators.required,
                Validators.pattern(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/),
                ],
            }),
            anticipatedAwardDate: new FormControl(record.anticipatedAwardDate ?? null, {
                validators: [Validators.required,
                Validators.pattern(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/),
                ],
            }),




            /** APFS Coordinator updated fields (role toggled later) */
            smallBusinessSetAside: new FormControl(record.smallBusinessSetAside ?? null),
            smallBusinessProgram: new FormControl(record.smallBusinessProgram ?? null, {
                validators: [
                    Validators.required, // keep if this field is required
                ],
            }),

            /** Coordinator-updated (role toggled later) */
            sbSpecialistFirstName: new FormControl(record.sbSpecialistFirstName ?? null),
            sbSpecialistLastName: new FormControl(record.sbSpecialistLastName ?? null),

            sbSpecialistPhone: new FormControl(record.sbSpecialistPhone ?? null, {
                validators: [
                    Validators.required, // keep if this field is required
                    Validators.maxLength(25),
                    Validators.pattern(/^\(\d{3}\)\s\d{3}-\d{4}(?:\s(?:ext\.|x)\s\d{1,6})?$/i),
                ],
            }),

            sbSpecialistEmail: new FormControl(record.sbSpecialistEmail ?? null, {
                validators: [
                    govEmailValidator(),
                    Validators.maxLength(254)
                ],
            }),
        },
        {
            validators: [
                recompeteRequiresIncumbentAndContractNumberValidator(),
                requestDateOrderValidator()
            ],
            updateOn: 'change'
        }
    ) as ForecastRecordFormGroup;

    // Safe default: keep non-requestor sections locked until permissions are applied.
    lockDownByDefault(form);

    // System-managed fields always disabled
    hardDisable(form.controls.apfsNumber);
    hardDisable(form.controls.workflowStatus);
    hardDisable(form.controls.component);
    hardDisable(form.controls.componentId);

    return form;
}

/**
 * Apply role-based enablement.
 */
export function applyForecastRecordRolePermissions(
    form: ForecastRecordFormGroup,
    profile: UserProfileLike | null | undefined,
    opts?: { claimedByMe?: boolean }

): void {
    const role = (profile?.role ?? '').trim().toLowerCase();
    const isRequirements = role === 'requirements';
    const isContractingOffice = role === 'contracting office' || role === 'contracting';
    const isCoordinator = role === 'apfs coordinator';
    const isAdmin = role === 'admin' || role.includes('admin');
    const claimedByMe = opts?.claimedByMe !== false; // default true

    // Offices edit window
    const lane = form.controls.workflowStatus.value;
    const officesEditableWindow =
        lane === ForecastWorkflowLane.Draft ||
        lane === ForecastWorkflowLane.Requirements ||
        lane === ForecastWorkflowLane.Contracting;

    const canEditOffices =
        isAdmin ||
        isRequirements ||
        (isContractingOffice && officesEditableWindow);
    // Requirements office: ID + label always controlled by system/profile, not user
    hardDisable(form.controls.requirementsOfficeId);
    hardDisable(form.controls.requirementsOffice);

    // Contracting / coordinator: enable/disable on *ID* controls
    setEnabled(form.controls.contractingOfficeId, canEditOffices);
    setEnabled(form.controls.coordinatorOfficeId, canEditOffices);

    // Labels follow IDs; we generally leave them enabled/readonly in the template
    // hardDisable(form.controls.contractingOffice);
    // hardDisable(form.controls.coordinatorOffice);

    // System-managed fields always disabled
    hardDisable(form.controls.apfsNumber);
    hardDisable(form.controls.workflowStatus);

    // ✅ Component fields are system-set from auth; keep them disabled always here too.
    hardDisable(form.controls.component);
    hardDisable(form.controls.componentId);

    // Claim lock
    if (!claimedByMe) {
        Object.keys(form.controls).forEach((k) => {
            if (k === 'apfsNumber' || k === 'workflowStatus' || k === 'component' || k === 'componentId') return;
            hardDisable((form.controls as any)[k]);
        });
        return;
    }

    // transitionComment always enabled
    setEnabled(form.controls.transitionComment, true);

    // Lane gating and role gating (unchanged)
    const laneStr = String(lane ?? '').trim().toLowerCase();

    const isDraftLane = lane === ForecastWorkflowLane.Draft;
    const isRequirementsLane = lane === ForecastWorkflowLane.Draft || lane === ForecastWorkflowLane.Requirements;
    const isContractingLane = lane === ForecastWorkflowLane.Contracting;
    const isCoordinatorLane = laneStr.includes('coordinator');

    const canEditRequirementsFields =
        (isRequirementsLane && (isAdmin || isRequirements)) ||
        (isContractingLane && (isAdmin || isContractingOffice)) ||
        (isCoordinatorLane && (isAdmin || isCoordinator));

    const canEditContractingFields =
        (isContractingLane && (isAdmin || isContractingOffice)) ||
        (isCoordinatorLane && (isAdmin || isCoordinator));

    const canEditCoordinatorFields =
        isCoordinatorLane && (isAdmin || isCoordinator);

    // Requirements section
    setEnabled(form.controls.requirementsTitle, canEditRequirementsFields);
    setEnabled(form.controls.requirement, canEditRequirementsFields);

    // Value classification (Requirements-owned)
    setEnabled(form.controls.dollarRange, canEditRequirementsFields);
    setEnabled(form.controls.naicsCode, canEditRequirementsFields);

    // Fiscal year (Requirements-owned)
    setEnabled(form.controls.fiscalYear, canEditRequirementsFields);
    setEnabled(form.controls.fiscalYearEstAward, canEditRequirementsFields);
    setEnabled(form.controls.fiscalYearSolicitation, canEditRequirementsFields);

    // Place of performance + POCs (Requirements-owned)
    setEnabled(form.controls.placeOfPerformanceCity, canEditRequirementsFields);
    setEnabled(form.controls.placeOfPerformanceState, canEditRequirementsFields);
    setEnabled(form.controls.placeOfPerformanceCountry, canEditRequirementsFields);
    setEnabled(form.controls.primaryContactFirstName, canEditRequirementsFields);
    setEnabled(form.controls.primaryContactLastName, canEditRequirementsFields);
    setEnabled(form.controls.primaryContactPhone, canEditRequirementsFields);
    setEnabled(form.controls.primaryContactEmail, canEditRequirementsFields);


    setEnabled(form.controls.competitive, canEditRequirementsFields);
    setEnabled(form.controls.contractStatus, canEditRequirementsFields);
    setEnabled(form.controls.incumbent, canEditRequirementsFields);
    setEnabled(form.controls.contractNumber, canEditRequirementsFields);

    // Alternate POC (Requirements-owned)
    setEnabled(form.controls.alternateContactFirstName, canEditRequirementsFields);
    setEnabled(form.controls.alternateContactLastName, canEditRequirementsFields);
    setEnabled(form.controls.alternateContactPhone, canEditRequirementsFields);
    setEnabled(form.controls.alternateContactEmail, canEditRequirementsFields);




    // Contracting Office section (Contracting-owned)
    setEnabled(form.controls.contractType, canEditContractingFields);
    setEnabled(form.controls.strategicSourcingVehicleUsed, canEditContractingFields);
    setEnabled(form.controls.strategicSourcingVehicle, canEditContractingFields);
    setEnabled(form.controls.typeOfAward, canEditRequirementsFields);
    //setEnabled(form.controls.smallBusinessSetAside, canEditContractingFields);
    setEnabled(form.controls.smallBusinessProgram, canEditContractingFields);

    // Contracting Role Section (Contracting-owned)
    setEnabled(form.controls.estimatedPopStart, canEditContractingFields);
    setEnabled(form.controls.estimatedPopEnd, canEditContractingFields);
    setEnabled(form.controls.anticipatedAwardDate, canEditContractingFields);
    setEnabled(form.controls.estimatedSolicitationReleaseDate, canEditContractingFields);

    // Coordinator section (Coordinator-owned)
    setEnabled(form.controls.sbSpecialistFirstName, canEditCoordinatorFields);
    setEnabled(form.controls.sbSpecialistLastName, canEditCoordinatorFields);
    setEnabled(form.controls.sbSpecialistPhone, canEditCoordinatorFields);
    setEnabled(form.controls.sbSpecialistEmail, canEditCoordinatorFields);


}

/**
 * Default lock-down so that if permissions are not applied,
 * CO/Coordinator fields don’t accidentally become editable.
 */
function lockDownByDefault(form: ForecastRecordFormGroup) {
    const keysToDisable: Array<keyof ForecastRecordFormGroup['controls']> = [
        // ✅ offices default disabled until perms apply
        'requirementsOfficeId',
        'contractingOfficeId',
        'coordinatorOfficeId',
        'requirementsOffice',
        'contractingOffice',
        'coordinatorOffice',
        'smallBusinessSetAside',
        'smallBusinessProgram',
        'dollarRange',
        'naicsCode',
        'contractType',
        'strategicSourcingVehicleUsed',
        'strategicSourcingVehicle',
        'competitive',
        'contractStatus',
        'incumbent',
        'contractNumber',
        'estimatedPopStart',
        'estimatedPopEnd',
        'anticipatedAwardDate',
        'estimatedSolicitationReleaseDate',
        'sbSpecialistFirstName',
        'sbSpecialistLastName',
        'sbSpecialistPhone',
        'sbSpecialistEmail',
        'fiscalYearEstAward',
        'fiscalYearSolicitation',
        'placeOfPerformanceCountry',
    ];

    keysToDisable.forEach((k) => hardDisable(form.controls[k]));
}

/** Enable/disable helpers */
function setEnabled(control: AbstractControl, enabled: boolean) {
    if (enabled) control.enable({ emitEvent: false });
    else control.disable({ emitEvent: false });
}
function hardDisable(control: AbstractControl) {
    control.disable({ emitEvent: false });
}

/** Validator: max word count (APFS says 500) */
function maxWords(limit: number) {
    return (control: AbstractControl<string>): ValidationErrors | null => {
        const text = (control.value ?? '').trim();
        if (!text) return null;
        const words = text.split(/\s+/).filter(Boolean).length;
        return words > limit ? { maxWords: { limit, actual: words } } : null;
    };
}

export function formatUsPhoneWithExt(raw: string): string {
    if (!raw) return '';

    const extMatch = raw.match(/(?:ext\.?|x)\s*(\d{1,6})$/i);
    const ext = extMatch ? extMatch[1] : null;

    const digits = raw.replace(/\D/g, '').slice(0, 10);

    let formatted = digits;

    if (digits.length >= 4 && digits.length <= 6) {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length >= 7) {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    return ext ? `${formatted} ext. ${ext}` : formatted;
}

export function noSpecialCharactersValidator(): ValidatorFn {
    const regex = /^[a-zA-Z0-9\s.,\-()'"/:&]*$/;

    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;
        if (!value) return null;

        return regex.test(value)
            ? null
            : { invalidCharacters: true };
    };
}

export function govEmailValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const value = (control.value ?? '').toLowerCase().trim();
        if (!value) return null;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return { email: true };
        }

        const domain = value.split('@')[1] || '';

        if (domain.endsWith('.gov') || domain.endsWith('.mil')) {
            return null;
        }

        return { govEmail: true };
    };




}
function parseMmDdYyyy(value: unknown): Date | null {
    if (typeof value !== 'string') return null;

    const normalized = value.trim();
    if (!normalized) return null;

    const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;

    const month = Number(match[1]) - 1;
    const day = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month, day);
    return date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day
        ? date
        : null;
}

function toDateOnly(value: unknown): Date | null {
    if (!value) return null;

    const s = String(value).trim();
    if (!s) return null;

    const parts = s.split('/');
    if (parts.length !== 3) return null;

    const [mm, dd, yyyy] = parts.map(Number);
    if (!mm || !dd || !yyyy) return null;

    return new Date(yyyy, mm - 1, dd);
}

export function requestDateOrderValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
        const popStart = toDateOnly(group.get('estimatedPopStart')?.value);
        const popEnd = toDateOnly(group.get('estimatedPopEnd')?.value);
        const solicitation = toDateOnly(group.get('estimatedSolicitationReleaseDate')?.value);
        const award = toDateOnly(group.get('anticipatedAwardDate')?.value);

        const errors: Record<string, true> = {};

        if (popStart && popEnd && popEnd < popStart) {
            errors['popEndBeforeStart'] = true;
        }

        if (solicitation && award && award < solicitation) {
            errors['awardBeforeSolicitation'] = true;
        }

        if (solicitation && popStart && solicitation > popStart) {
            errors['solicitationAfterPopStart'] = true;
        }

        return Object.keys(errors).length ? errors : null;
    };
}


