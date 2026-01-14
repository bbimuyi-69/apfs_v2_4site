// forecast-record.form.ts (drop-in replacement)
//
// ✅ Adds 3 new office dropdown controls:
//    - requirementsOffice
//    - contractingOffice
//    - coordinatorOffice
//
// ✅ Locks component from being edited via permissions (your component will also hard-lock it from auth)
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

export type ForecastRecordFormGroup = FormGroup<{
    /** System / workflow */
    apfsNumber: FormControl<string | null>;

    /** ✅ Real workflow lane (keep disabled) */
    workflowStatus: FormControl<ForecastWorkflowLane>;

    /** Top section */
    component: FormControl<string | null>;

    /** ✅ NEW: office dropdowns for the 3 roles (in requirements section UI for now) */
    requirementsOffice: FormControl<string | null>;
    contractingOffice: FormControl<string | null>;
    coordinatorOffice: FormControl<string | null>;

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

export function buildForecastRecordForm(record: ForecastRecord): ForecastRecordFormGroup {
    // ✅ Canonical lane value. Prefer workflowStatus; fall back to legacy (record as any).status.
    const lane: ForecastWorkflowLane =
        ((record as any).workflowStatus ??
            (record as any).status ??
            ForecastWorkflowLane.Draft) as ForecastWorkflowLane;

    const form = new FormGroup({
        /** System generated */
        apfsNumber: new FormControl({ value: record.apfsNumber, disabled: true }),

        /** ✅ Real workflow lane - keep disabled */
        workflowStatus: new FormControl(
            { value: lane, disabled: true },
            { nonNullable: true }
        ),

        /** Editable by requester (role toggled later) */
        component: new FormControl(record.component, {
            validators: [Validators.required],
        }),

        /** ✅ NEW: offices (not required yet) */
        requirementsOffice: new FormControl((record as any).requirementsOffice ?? null),
        contractingOffice: new FormControl((record as any).contractingOffice ?? null),
        coordinatorOffice: new FormControl((record as any).coordinatorOffice ?? null),

        requirementsTitle: new FormControl(record.requirementsTitle, {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(200)],
        }),

        requirement: new FormControl(record.requirement, {
            nonNullable: true,
            validators: [Validators.required, maxWords(500)],
        }),

        programLevel: new FormControl(record.programLevel),

        /** APFS Coordinator updated fields (role toggled later) */
        smallBusinessSetAside: new FormControl(record.smallBusinessSetAside),
        smallBusinessProgram: new FormControl(record.smallBusinessProgram),

        /** Value classification (role toggled later) */
        dollarRange: new FormControl(record.dollarRange),
        naicsCode: new FormControl(record.naicsCode),

        /** Contracting Officer updated fields (role toggled later) */
        contractType: new FormControl(record.contractType),
        strategicSourcingVehicleUsed: new FormControl(record.strategicSourcingVehicleUsed),
        strategicSourcingVehicle: new FormControl(record.strategicSourcingVehicle),
        typeOfAward: new FormControl(record.typeOfAward),

        competitive: new FormControl(record.competitive),
        contractStatus: new FormControl(record.contractStatus),

        incumbent: new FormControl(record.incumbent),
        contractNumber: new FormControl(record.contractNumber),

        /** Dates (role toggled later) */
        estimatedPopStart: new FormControl(record.estimatedPopStart),
        estimatedPopEnd: new FormControl(record.estimatedPopEnd),
        fiscalYear: new FormControl(record.fiscalYear),

        anticipatedAwardDate: new FormControl(record.anticipatedAwardDate),
        estimatedSolicitationReleaseDate: new FormControl(record.estimatedSolicitationReleaseDate),

        placeOfPerformanceCity: new FormControl(record.placeOfPerformanceCity),
        placeOfPerformanceState: new FormControl(record.placeOfPerformanceState),

        primaryContactFirstName: new FormControl(record.primaryContactFirstName, {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(100)],
        }),
        primaryContactLastName: new FormControl(record.primaryContactLastName, {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(100)],
        }),
        primaryContactPhone: new FormControl(record.primaryContactPhone),
        primaryContactEmail: new FormControl(record.primaryContactEmail, {
            nonNullable: true,
            validators: [Validators.required, Validators.email, Validators.maxLength(254)],
        }),

        alternateContactFirstName: new FormControl(record.alternateContactFirstName),
        alternateContactLastName: new FormControl(record.alternateContactLastName),
        alternateContactPhone: new FormControl(record.alternateContactPhone),
        alternateContactEmail: new FormControl(record.alternateContactEmail, {
            validators: [Validators.email],
        }),

        /** Coordinator-updated (role toggled later) */
        sbSpecialistFirstName: new FormControl(record.sbSpecialistFirstName),
        sbSpecialistLastName: new FormControl(record.sbSpecialistLastName),
        sbSpecialistPhone: new FormControl(record.sbSpecialistPhone),
        sbSpecialistEmail: new FormControl(record.sbSpecialistEmail),
    }) as ForecastRecordFormGroup;

    // Safe default: keep non-requestor sections locked until permissions are applied.
    lockDownByDefault(form);

    return form;
}

/**
 * Apply role-based enablement.
 * Call this AFTER enabling the form in edit mode.
 * (Your component does: form.enable() then this, so this always wins.)
 */
export function applyForecastRecordRolePermissions(
    form: ForecastRecordFormGroup,
    profile: UserProfileLike | null | undefined
): void {
    console.log('[Perms] role=', profile?.role);
    const role = (profile?.role ?? '').trim().toLowerCase();
    const isRequirements = role === 'requirements';
    const isContractingOffice = role === 'contracting office' || role === 'contracting';
    const isCoordinator = role === 'apfs coordinator';

    // ---- Offices edit window ----
    const lane = form.controls.workflowStatus.value;
    const officesEditableWindow =
        lane === ForecastWorkflowLane.Draft ||
        lane === ForecastWorkflowLane.Requirements;

    const canEditOffices = isRequirements && officesEditableWindow;


    // System-managed fields always disabled
    hardDisable(form.controls.apfsNumber);
    hardDisable(form.controls.workflowStatus);

    // ✅ Component is system-set from auth; keep it disabled always here too.
    // (Your component also hard-locks it after permissions apply.)
    hardDisable(form.controls.component);

    // ✅ NEW: offices
    // For now: let each lane edit its own office selection.
    // (You said you want them in the Requirements section UI, but role-based enablement still makes sense.)
    // Offices — editable only in Draft/Requirements by Requirements role
    setEnabled(form.controls.requirementsOffice, canEditOffices);
    setEnabled(form.controls.contractingOffice, canEditOffices);
    setEnabled(form.controls.coordinatorOffice, canEditOffices);


    // Requirements section
    setEnabled(form.controls.requirementsTitle, isRequirements);
    setEnabled(form.controls.requirement, isRequirements);
    setEnabled(form.controls.programLevel, isRequirements);

    // Coordinator section
    setEnabled(form.controls.smallBusinessSetAside, isCoordinator);
    setEnabled(form.controls.smallBusinessProgram, isCoordinator);

    setEnabled(form.controls.sbSpecialistFirstName, isCoordinator);
    setEnabled(form.controls.sbSpecialistLastName, isCoordinator);
    setEnabled(form.controls.sbSpecialistPhone, isCoordinator);
    setEnabled(form.controls.sbSpecialistEmail, isCoordinator);

    // Value classification (default: Coordinator + Contracting Office)
    setEnabled(form.controls.dollarRange, isCoordinator || isContractingOffice);
    setEnabled(form.controls.naicsCode, isCoordinator || isContractingOffice);

    // Contracting Office section
    setEnabled(form.controls.contractType, isContractingOffice);
    setEnabled(form.controls.strategicSourcingVehicleUsed, isContractingOffice);
    setEnabled(form.controls.strategicSourcingVehicle, isContractingOffice);
    setEnabled(form.controls.typeOfAward, isContractingOffice);

    setEnabled(form.controls.competitive, isContractingOffice);
    setEnabled(form.controls.contractStatus, isContractingOffice);
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
        // ✅ NEW: offices default disabled until perms apply
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
