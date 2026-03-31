// forecast-record.form.ts (drop-in replacement)
//
// ✅ Adds 3 office dropdown controls:
//    - requirementsOffice
//    - contractingOffice
//    - coordinatorOffice
//
// ✅ Adds transitionComment control (UI-only action field) to support onTransition validation
//
// ✅ Locks component from being edited via permissions (component will also hard-lock from auth)
// ✅ Keeps everything else as-is

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
    component: FormControl<string | null>;

    /** ✅ NEW: office dropdowns */
    requirementsOffice: FormControl<string | null>;
    contractingOffice: FormControl<string | null>;
    coordinatorOffice: FormControl<string | null>;

    /** ✅ NEW: UI-only action field used when transitioning lanes */
    transitionComment: FormControl<string>;

    requirementsTitle: FormControl<string>;
    requirement: FormControl<string>;

    //    programLevel: FormControl<string | null>;

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

    anticipatedAwardDate: FormControl<string | null>;
    estimatedSolicitationReleaseDate: FormControl<string | null>;

    /** Place of performance */
    placeOfPerformanceCity: FormControl<string | null>;
    placeOfPerformanceState: FormControl<string | null>;

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
    component?: string;
    employeeType?: string;
    isActive?: boolean;
};

type ForecastRecordWithOffices = ForecastRecord & {
    requirementsOffice?: string | null;
    contractingOffice?: string | null;
    coordinatorOffice?: string | null;
    workflowStatus?: ForecastWorkflowLane; // if your model already has it, great
    status?: any; // legacy
};

export function buildForecastRecordForm(record: ForecastRecord): ForecastRecordFormGroup {
    const r = record as ForecastRecordWithOffices;

    // ✅ Canonical lane value. Prefer workflowStatus; fall back to legacy status.
    const lane: ForecastWorkflowLane =
        (r.workflowStatus ??
            (r.status as ForecastWorkflowLane) ??
            ForecastWorkflowLane.Draft) as ForecastWorkflowLane;


    //this is the main form builder with new fields added and validation as needed
    //Look here for adding new fields to the form        
    const form = new FormGroup(
        {
            /** System generated */
            apfsNumber: new FormControl({ value: record.apfsNumber ?? null, disabled: true }),

            /** ✅ Real workflow lane - keep disabled */
            workflowStatus: new FormControl({ value: lane, disabled: true }, { nonNullable: true }),

            /** Editable by requester (role toggled later) */
            component: new FormControl(record.component ?? null, {
                validators: [Validators.required],
            }),

            /** ✅ NEW: offices (not required yet) */
            requirementsOffice: new FormControl(r.requirementsOffice ?? null),
            contractingOffice: new FormControl(r.contractingOffice ?? null),
            coordinatorOffice: new FormControl(r.coordinatorOffice ?? null),

            /** ✅ NEW: UI-only action field used during transitions */
            transitionComment: new FormControl('', { nonNullable: true }),

            requirementsTitle: new FormControl(record.requirementsTitle ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(255), noSpecialCharactersValidator()],
            }),

            requirement: new FormControl(record.requirement ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(600), noSpecialCharactersValidator()],
            }),

            //programLevel: new FormControl(record.programLevel ?? null),

            /** APFS Coordinator updated fields (role toggled later) */
            smallBusinessSetAside: new FormControl(record.smallBusinessSetAside ?? null),
            smallBusinessProgram: new FormControl(record.smallBusinessProgram ?? null),

            /** Value classification (role toggled later) */
            dollarRange: new FormControl(record.dollarRange ?? null),
            naicsCode: new FormControl(record.naicsCode ?? null),

            /** Contracting Officer updated fields (role toggled later) */
            contractType: new FormControl(record.contractType ?? null),
            strategicSourcingVehicleUsed: new FormControl(record.strategicSourcingVehicleUsed ?? null),
            strategicSourcingVehicle: new FormControl(record.strategicSourcingVehicle ?? null),
            typeOfAward: new FormControl(record.typeOfAward ?? null),

            competitive: new FormControl(record.competitive ?? null),
            contractStatus: new FormControl(record.contractStatus ?? null),

            incumbent: new FormControl(record.incumbent ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(100), noSpecialCharactersValidator()],
            }),

            contractNumber: new FormControl(record.contractNumber ?? null),

            fiscalYear: new FormControl(record.fiscalYear ?? null),


            /** Dates (role toggled later) */
            //estimatedPopStart: new FormControl(record.estimatedPopStart ?? null),
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






            placeOfPerformanceCity: new FormControl(record.placeOfPerformanceCity ?? null),
            placeOfPerformanceState: new FormControl(record.placeOfPerformanceState ?? null),

            primaryContactFirstName: new FormControl(record.primaryContactFirstName ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(100)],
            }),
            primaryContactLastName: new FormControl(record.primaryContactLastName ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(100)],
            }),
            //            primaryContactPhone: new FormControl(record.primaryContactPhone ?? null),
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

            alternateContactFirstName: new FormControl(record.alternateContactFirstName ?? null),
            alternateContactLastName: new FormControl(record.alternateContactLastName ?? null),
            alternateContactPhone: new FormControl(record.alternateContactPhone ?? null),
            alternateContactEmail: new FormControl(record.alternateContactEmail ?? null, {
                validators: [
                    Validators.required,
                    govEmailValidator(),
                    Validators.maxLength(254)
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

            sbSpecialistEmail: new FormControl(record.sbSpecialistEmail ?? null),
        },
        { updateOn: 'change' }
    ) as ForecastRecordFormGroup;

    // Safe default: keep non-requestor sections locked until permissions are applied.
    lockDownByDefault(form);

    // System-managed fields always disabled
    hardDisable(form.controls.apfsNumber);
    hardDisable(form.controls.workflowStatus);
    hardDisable(form.controls.component);

    return form;
}

/**
 * Apply role-based enablement.
 * Call this AFTER enabling the form in edit mode.
 * This is where the role-based field enablement logic lives.
 * this is not what makes a field required though - that is done in the component on transition actions
 * //PAY ATTENTION
 * this is what disables fields via css
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

    // ✅ Claim gate: if the record is not claimed by the current user, lock everything down.
    // Note: Admin/Super Admin still must claim (per your rule).
    const claimedByMe = opts?.claimedByMe !== false; // default true for backwards compatibility

    // ---- Offices edit window ----
    const lane = form.controls.workflowStatus.value;
    const officesEditableWindow =
        lane === ForecastWorkflowLane.Draft || lane === ForecastWorkflowLane.Requirements || lane === ForecastWorkflowLane.Contracting;

    const canEditOffices = isAdmin || isRequirements || (isContractingOffice && officesEditableWindow);

    // System-managed fields always disabled
    hardDisable(form.controls.apfsNumber);
    hardDisable(form.controls.workflowStatus);

    // ✅ Component is system-set from auth; keep it disabled always here too.
    hardDisable(form.controls.component);

    // ✅ Claim lock: if not claimed-by-me, force the entire form (except system fields) into read-only.
    if (!claimedByMe) {
        Object.keys(form.controls).forEach((k) => {
            if (k === 'apfsNumber' || k === 'workflowStatus' || k === 'component') return;
            hardDisable((form.controls as any)[k]);
        });
        return;
    }

    // ✅ Offices — editable only in Draft/Requirements by Requirements role
    hardDisable(form.controls.requirementsOffice);
    setEnabled(form.controls.contractingOffice, canEditOffices);
    setEnabled(form.controls.coordinatorOffice, canEditOffices);

    // ✅ transitionComment is NOT role-based — it's action-based.
    // Keep it enabled so the UI can use it when user clicks a transition button.
    // (If you render it only inside an action panel, it’s fine to leave enabled always.)
    setEnabled(form.controls.transitionComment, true);

    // Lane gating: keep validation aligned to the workflow lane.
    // Admin/Super Admin can bypass role restrictions, but NOT lane restrictions (so validation stays in-lane).
    const laneStr = String(lane ?? '').trim().toLowerCase();

    const isDraftLane = lane === ForecastWorkflowLane.Draft;
    const isRequirementsLane = lane === ForecastWorkflowLane.Draft || lane === ForecastWorkflowLane.Requirements;
    const isContractingLane = lane === ForecastWorkflowLane.Contracting;

    // Some enum builds don't include a Coordinator member. We keep lane-gating robust by
    // matching on the string value (e.g. 'Coordinator' or 'APFS Coordinator').
    const isCoordinatorLane = laneStr.includes('coordinator');

    // Requirements fields are editable:
    // - in Draft/Requirements by Requirements (or Admin)
    // - in Contracting by Contracting Office (or Admin) — matches your rail behavior
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
    //setEnabled(form.controls.programLevel, canEditRequirementsFields);

    // Value classification (Requirements-owned)
    setEnabled(form.controls.dollarRange, canEditRequirementsFields);
    setEnabled(form.controls.naicsCode, canEditRequirementsFields);

    // Fiscal year (Requirements-owned)
    setEnabled(form.controls.fiscalYear, canEditRequirementsFields);

    // Place of performance + POCs (Requirements-owned)
    setEnabled(form.controls.placeOfPerformanceCity, canEditRequirementsFields);
    setEnabled(form.controls.placeOfPerformanceState, canEditRequirementsFields);
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
    setEnabled(form.controls.typeOfAward, canEditContractingFields);
    setEnabled(form.controls.smallBusinessSetAside, canEditContractingFields);
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
        'requirementsOffice',
        'contractingOffice',
        'coordinatorOffice',

        // leave transitionComment enabled by default? up to you.
        // If you want it hidden/only used in actions panel but still editable:
        // DON'T disable it here.
        // If you want it disabled unless UI action panel opens, comment this in/out accordingly:
        // 'transitionComment',

        'smallBusinessSetAside',
        'smallBusinessProgram',
        'dollarRange',
        'naicsCode',
        'contractType',
        'strategicSourcingVehicleUsed',
        'strategicSourcingVehicle',
        'typeOfAward',
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

    // Split extension if user typed x / ext
    const extMatch = raw.match(/(?:ext\.?|x)\s*(\d{1,6})$/i);
    const ext = extMatch ? extMatch[1] : null;

    // Remove all non-digits from main number
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
    // Allow letters, numbers, space, and common punctuation
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
        if (!value) return null; // let required handle empty

        // must be valid email first
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return { email: true }; // reuse existing message
        }

        // allowed domains
        if (
            value.endsWith('.mil') ||
            value.endsWith('.gov') ||
            value.endsWith('@bvti.com')
        ) {
            return null;
        }

        return { govEmail: true };
    };
}

