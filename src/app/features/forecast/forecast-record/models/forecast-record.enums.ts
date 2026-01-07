/** Business approval outcome (separate from workflow lane) */
export enum ForecastStatus {
    Draft = 'DRAFT',
    Submitted = 'SUBMITTED',
    Approved = 'APPROVED',
    Rejected = 'REJECTED'
}

/**
 * Workflow ownership lane (single source of truth)
 * Drives queueing, assignment, and progression.
 */
export enum ForecastWorkflowLane {
    Draft = 'Draft',
    Requirements = 'Requirements',
    Contracting = 'Contracting',
    APFSCoordinator = 'APFS Coordinator',
    Published = 'Published'
}

/** Confidence / maturity indicator */
export enum ConfidenceLevel {
    Low = 'LOW',
    Medium = 'MEDIUM',
    High = 'HIGH'
}
