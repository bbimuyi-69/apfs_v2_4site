import {
    AbstractControl,
    FormControl,
    FormGroup,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { ForecastRecord, ForecastRecordStatus } from '../../models/forecast-record.model';

export type ForecastRecordFormGroup = FormGroup<{
    /** System / workflow */
    apfsNumber: FormControl<string | null>;
    status: FormControl<ForecastRecordStatus>;

    /** Top section */
    component: FormControl<string | null>;

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

export function buildForecastRecordForm(
    record: ForecastRecord
): ForecastRecordFormGroup {
    return new FormGroup({
        /** System generated */
        apfsNumber: new FormControl({ value: record.apfsNumber, disabled: true }),

        status: new FormControl(
            { value: record.status ?? 'Draft', disabled: true },
            { nonNullable: true }
        ),

        /** Editable by requester */
        component: new FormControl(record.component, {
            validators: [Validators.required],
        }),

        requirementsTitle: new FormControl(record.requirementsTitle, {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(200)],
        }),

        requirement: new FormControl(record.requirement, {
            nonNullable: true,
            validators: [Validators.required, maxWords(500)],
        }),

        programLevel: new FormControl(record.programLevel),

        /** APFS Coordinator-updated (disabled for now) */
        smallBusinessSetAside: new FormControl({
            value: record.smallBusinessSetAside,
            disabled: true,
        }),
        smallBusinessProgram: new FormControl({
            value: record.smallBusinessProgram,
            disabled: true,
        }),

        dollarRange: new FormControl(record.dollarRange),
        naicsCode: new FormControl(record.naicsCode),

        /** Contracting Officer-updated (disabled for now) */
        contractType: new FormControl({
            value: record.contractType,
            disabled: true,
        }),
        strategicSourcingVehicleUsed: new FormControl({
            value: record.strategicSourcingVehicleUsed,
            disabled: true,
        }),
        strategicSourcingVehicle: new FormControl({
            value: record.strategicSourcingVehicle,
            disabled: true,
        }),
        typeOfAward: new FormControl({
            value: record.typeOfAward,
            disabled: true,
        }),

        competitive: new FormControl(record.competitive),
        contractStatus: new FormControl(record.contractStatus),

        incumbent: new FormControl(record.incumbent),
        contractNumber: new FormControl(record.contractNumber),

        estimatedPopStart: new FormControl({
            value: record.estimatedPopStart,
            disabled: true,
        }),
        estimatedPopEnd: new FormControl({
            value: record.estimatedPopEnd,
            disabled: true,
        }),
        fiscalYear: new FormControl(record.fiscalYear),

        anticipatedAwardDate: new FormControl({
            value: record.anticipatedAwardDate,
            disabled: true,
        }),
        estimatedSolicitationReleaseDate: new FormControl({
            value: record.estimatedSolicitationReleaseDate,
            disabled: true,
        }),

        placeOfPerformanceCity: new FormControl(
            record.placeOfPerformanceCity
        ),
        placeOfPerformanceState: new FormControl(
            record.placeOfPerformanceState
        ),

        primaryContactFirstName: new FormControl(
            record.primaryContactFirstName,
            {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(100)],
            }
        ),
        primaryContactLastName: new FormControl(
            record.primaryContactLastName,
            {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(100)],
            }
        ),
        primaryContactPhone: new FormControl(
            record.primaryContactPhone
        ),
        primaryContactEmail: new FormControl(
            record.primaryContactEmail,
            {
                nonNullable: true,
                validators: [
                    Validators.required,
                    Validators.email,
                    Validators.maxLength(254),
                ],
            }
        ),

        alternateContactFirstName: new FormControl(
            record.alternateContactFirstName
        ),
        alternateContactLastName: new FormControl(
            record.alternateContactLastName
        ),
        alternateContactPhone: new FormControl(
            record.alternateContactPhone
        ),
        alternateContactEmail: new FormControl(
            record.alternateContactEmail,
            { validators: [Validators.email] }
        ),

        /** Coordinator-updated (disabled for now) */
        sbSpecialistFirstName: new FormControl({
            value: record.sbSpecialistFirstName,
            disabled: true,
        }),
        sbSpecialistLastName: new FormControl({
            value: record.sbSpecialistLastName,
            disabled: true,
        }),
        sbSpecialistPhone: new FormControl({
            value: record.sbSpecialistPhone,
            disabled: true,
        }),
        sbSpecialistEmail: new FormControl({
            value: record.sbSpecialistEmail,
            disabled: true,
        }),
    });
}

/** Validator: max word count (APFS says 500) */
function maxWords(limit: number) {
    return (control: AbstractControl<string>): ValidationErrors | null => {
        const text = (control.value ?? '').trim();
        if (!text) return null;
        const words = text.split(/\s+/).filter(Boolean).length;
        return words > limit
            ? { maxWords: { limit, actual: words } }
            : null;
    };
}
