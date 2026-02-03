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
} from '@angular/forms';

import { ForecastRecord } from '../../models/forecast-record.model';
import { ForecastWorkflowLane } from '../../models/forecast-record.enums';

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

    programLevel: FormControl<string | null>;

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
                validators: [Validators.required, Validators.maxLength(200)],
            }),

            requirement: new FormControl(record.requirement ?? '', {
                nonNullable: true,
                validators: [Validators.required, maxWords(500)],
            }),

            programLevel: new FormControl(record.programLevel ?? null),

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

            incumbent: new FormControl(record.incumbent ?? null),
            contractNumber: new FormControl(record.contractNumber ?? null),

            /** Dates (role toggled later) */
            estimatedPopStart: new FormControl(record.estimatedPopStart ?? null),
            estimatedPopEnd: new FormControl(record.estimatedPopEnd ?? null),
            fiscalYear: new FormControl(record.fiscalYear ?? null),

            anticipatedAwardDate: new FormControl(record.anticipatedAwardDate ?? null),
            estimatedSolicitationReleaseDate: new FormControl(record.estimatedSolicitationReleaseDate ?? null),

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
                validators: [Validators.required, Validators.email, Validators.maxLength(254)],
            }),

            alternateContactFirstName: new FormControl(record.alternateContactFirstName ?? null),
            alternateContactLastName: new FormControl(record.alternateContactLastName ?? null),
            alternateContactPhone: new FormControl(record.alternateContactPhone ?? null),
            alternateContactEmail: new FormControl(record.alternateContactEmail ?? null, {
                validators: [Validators.email],
            }),

            /** Coordinator-updated (role toggled later) */
            sbSpecialistFirstName: new FormControl(record.sbSpecialistFirstName ?? null),
            sbSpecialistLastName: new FormControl(record.sbSpecialistLastName ?? null),
            sbSpecialistPhone: new FormControl(record.sbSpecialistPhone ?? null),
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
 * //PAY ATTENTION
 * this is what disables fields via css
 */
export function applyForecastRecordRolePermissions(
    form: ForecastRecordFormGroup,
    profile: UserProfileLike | null | undefined
): void {
    const role = (profile?.role ?? '').trim().toLowerCase();
    const isRequirements = role === 'requirements';
    const isContractingOffice = role === 'contracting office' || role === 'contracting';
    const isCoordinator = role === 'apfs coordinator';

    // ---- Offices edit window ----
    const lane = form.controls.workflowStatus.value;
    const officesEditableWindow =
        lane === ForecastWorkflowLane.Draft || lane === ForecastWorkflowLane.Requirements || lane === ForecastWorkflowLane.Contracting;

    const canEditOffices = isRequirements || isContractingOffice && officesEditableWindow;

    // System-managed fields always disabled
    hardDisable(form.controls.apfsNumber);
    hardDisable(form.controls.workflowStatus);

    // ✅ Component is system-set from auth; keep it disabled always here too.
    hardDisable(form.controls.component);

    // ✅ Offices — editable only in Draft/Requirements by Requirements role
    setEnabled(form.controls.requirementsOffice, canEditOffices);
    setEnabled(form.controls.contractingOffice, canEditOffices);
    setEnabled(form.controls.coordinatorOffice, canEditOffices);

    // ✅ transitionComment is NOT role-based — it's action-based.
    // Keep it enabled so the UI can use it when user clicks a transition button.
    // (If you render it only inside an action panel, it’s fine to leave enabled always.)
    setEnabled(form.controls.transitionComment, true);

    // Requirements section
    setEnabled(form.controls.requirementsTitle, isRequirements || isContractingOffice);
    setEnabled(form.controls.requirement, isRequirements || isContractingOffice);
    setEnabled(form.controls.programLevel, isRequirements || isContractingOffice);

    // Coordinator section
    setEnabled(form.controls.smallBusinessSetAside, isCoordinator);
    setEnabled(form.controls.smallBusinessProgram, isCoordinator);

    setEnabled(form.controls.sbSpecialistFirstName, isCoordinator);
    setEnabled(form.controls.sbSpecialistLastName, isCoordinator);
    setEnabled(form.controls.sbSpecialistPhone, isCoordinator);
    setEnabled(form.controls.sbSpecialistEmail, isCoordinator);

    // Value classification (default: Coordinator + Contracting Office)
    setEnabled(form.controls.dollarRange, isRequirements || isCoordinator || isContractingOffice);
    setEnabled(form.controls.naicsCode, isRequirements || isCoordinator || isContractingOffice);

    // Contracting Office section
    setEnabled(form.controls.contractType, isContractingOffice);
    setEnabled(form.controls.strategicSourcingVehicleUsed, isContractingOffice);
    setEnabled(form.controls.strategicSourcingVehicle, isContractingOffice);
    setEnabled(form.controls.typeOfAward, isContractingOffice);

    setEnabled(form.controls.competitive, isRequirements || isContractingOffice);
    setEnabled(form.controls.contractStatus, isRequirements || isContractingOffice);
    setEnabled(form.controls.incumbent, isContractingOffice);
    setEnabled(form.controls.contractNumber, isContractingOffice);

    setEnabled(form.controls.estimatedPopStart, isContractingOffice);
    setEnabled(form.controls.estimatedPopEnd, isContractingOffice);
    setEnabled(form.controls.anticipatedAwardDate, isContractingOffice);
    setEnabled(form.controls.estimatedSolicitationReleaseDate, isContractingOffice);

    // Fiscal year: keep with Requirements by default (change if needed)
    setEnabled(form.controls.fiscalYear, isRequirements);

    // Place of performance + POCs (Requirements by default)
    setEnabled(form.controls.placeOfPerformanceCity, isRequirements);
    setEnabled(form.controls.placeOfPerformanceState, isRequirements);

    setEnabled(form.controls.primaryContactFirstName, isRequirements);
    setEnabled(form.controls.primaryContactLastName, isRequirements);
    setEnabled(form.controls.primaryContactPhone, isRequirements);
    setEnabled(form.controls.primaryContactEmail, isRequirements);

    setEnabled(form.controls.alternateContactFirstName, isRequirements);
    setEnabled(form.controls.alternateContactLastName, isRequirements);
    setEnabled(form.controls.alternateContactPhone, isRequirements);
    setEnabled(form.controls.alternateContactEmail, isRequirements);
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
