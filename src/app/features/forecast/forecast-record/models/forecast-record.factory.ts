import { ForecastRecord } from './forecast-record.model';
import { ForecastStatus, ForecastWorkflowLane } from './forecast-record.enums';

export function createEmptyForecastRecord(): ForecastRecord {
    return {
        /** Workflow / persistence */
        id: undefined,

        // ✅ workflow lane starts in Draft (single source of truth)
        workflowStatus: ForecastWorkflowLane.Draft,

        // ✅ business approval outcome
        forecastStatus: ForecastStatus.Draft,

        createdAt: undefined,
        updatedAt: undefined,
        submittedAt: null,
        submittedBy: null,

        /** 🔑 Assignment / claim ownership */
        assignedToUserId: null,
        assignedToName: null,
        assignedAt: null,

        /** System-generated */
        apfsNumber: null,

        /** Top section */
        component: null,
        requirementsTitle: '',
        requirement: '',
        programLevel: null,

        /** APFS Coordinator updated fields */
        smallBusinessSetAside: null,
        smallBusinessProgram: null,

        /** Value classification */
        dollarRange: null,
        naicsCode: null,

        /** Contracting Officer updated fields */
        contractType: null,
        strategicSourcingVehicleUsed: null,
        strategicSourcingVehicle: null,
        typeOfAward: null,

        competitive: null,
        contractStatus: null,

        incumbent: null,
        contractNumber: null,

        /** Dates (CO-updated) */
        estimatedPopStart: null,
        estimatedPopEnd: null,
        fiscalYear: null,

        anticipatedAwardDate: null,
        estimatedSolicitationReleaseDate: null,

        /** Place of performance */
        placeOfPerformanceCity: null,
        placeOfPerformanceState: null,

        /** Primary POC */
        primaryContactFirstName: '',
        primaryContactLastName: '',
        primaryContactPhone: null,
        primaryContactEmail: '',

        /** Alternate POC (optional) */
        alternateContactFirstName: null,
        alternateContactLastName: null,
        alternateContactPhone: null,
        alternateContactEmail: null,

        /** Small Business Specialist / APFS Coordinator */
        sbSpecialistFirstName: null,
        sbSpecialistLastName: null,
        sbSpecialistPhone: null,
        sbSpecialistEmail: null,

        //** For published history tracking
        previous_published_date: null,
        published_date: null,
    };
}
