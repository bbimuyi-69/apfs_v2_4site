export type EmployeeType = 'Federal Employee' | 'Contractor';

export const EMPLOYEE_TYPES: EmployeeType[] = [
    'Federal Employee',
    'Contractor'
];

export const COMPONENTS: string[] = [
    'CISA', 'CBP', 'FEMA', 'ICE', 'TSA', 'USCG', 'HQ', 'USSS'
];

export const OFFICES_BY_COMPONENT: Record<string, string[]> = {
    CISA: ['OCIO', 'Operations', 'Acquisitions'],
    CBP: ['Office of Trade', 'Office of Field Operations', 'OIT'],
    FEMA: ['Procurement', 'Grants', 'Logistics'],
    ICE: ['ERO', 'HSI', 'Management'],
    TSA: ['Acquisition', 'Security Ops', 'IT'],
    USCG: ['Acquisition Directorate', 'Operations', 'C4IT'],
    HQ: ['OCIO', 'Procurement', 'Finance'],
    USSS: ['CIO', 'SSD', 'Finance']
};

export const ROLES_BY_EMPLOYEE_TYPE: Record<EmployeeType, string[]> = {
    'Federal Employee': ['Requirements', 'Contracting', 'APFS Coordinator', 'Admin'],
    Contractor: ['Requirements']
};