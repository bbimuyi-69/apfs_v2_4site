import { ForecastStatus, ForecastWorkflowLane } from './forecast-record.enums';

export interface ForecastRecord {
    /** Workflow / persistence */
    id?: number; // Node JSON DB id (Date.now())

    /** Workflow ownership (lane) */
    workflowStatus: ForecastWorkflowLane;

    /** Business approval outcome */
    forecastStatus: ForecastStatus;

    createdAt?: string;
    updatedAt?: string;
    submittedAt?: string | null;
    submittedBy?: string | null;

    /** 🔑 Assignment / claim ownership (NEW) */
    assignedToUserId?: string | null; // used for Queue vs Claimed logic
    assignedToName?: string | null; // display only
    assignedAt?: string | null;

    /** System-generated */
    apfsNumber: string | null;

    /** Top section */
    component: string | null;
    requirementsTitle: string;
    requirement: string; // (500-word limit)
    programLevel: string | null;

    /** APFS Coordinator updated fields */
    smallBusinessSetAside: string | null;
    smallBusinessProgram: string | null;

    /** Value classification */
    dollarRange: string | null;
    naicsCode: string | null;

    /** Contracting Officer updated fields */
    contractType: string | null;
    strategicSourcingVehicleUsed: string | null;
    strategicSourcingVehicle: string | null;
    typeOfAward: string | null;

    competitive: string | null;
    contractStatus: string | null;

    incumbent: string | null;
    contractNumber: string | null;

    /** Dates (CO-updated) */
    estimatedPopStart: string | null;
    estimatedPopEnd: string | null;
    fiscalYear: number | null;

    anticipatedAwardDate: string | null;
    estimatedSolicitationReleaseDate: string | null;

    /** Place of performance */
    placeOfPerformanceCity: string | null;
    placeOfPerformanceState: string | null;

    /** Primary POC */
    primaryContactFirstName: string;
    primaryContactLastName: string;
    primaryContactPhone: string | null;
    primaryContactEmail: string;

    /** Alternate POC (optional) */
    alternateContactFirstName: string | null;
    alternateContactLastName: string | null;
    alternateContactPhone: string | null;
    alternateContactEmail: string | null;

    /** Small Business Specialist / APFS Coordinator */
    sbSpecialistFirstName: string | null;
    sbSpecialistLastName: string | null;
    sbSpecialistPhone: string | null;
    sbSpecialistEmail: string | null;

    /** Allow backend expansion without breaking frontend */
    [key: string]: any;
}
