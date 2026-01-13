export type EmployeeType = 'Federal Employee' | 'Contractor';

export const EMPLOYEE_TYPES: EmployeeType[] = [
    'Federal Employee',
    'Contractor'
];

export const COMPONENTS: string[] = [
    'CISA',
    'CBP',
    'FEMA',
    'ICE',
    'TSA',
    'USCG',
    'HQ',
    'USSS'
];

// ✅ Role strings must match db + form exactly
export const ROLES_BY_EMPLOYEE_TYPE: Record<EmployeeType, string[]> = {
    'Federal Employee': ['Requirements', 'Contracting Office', 'APFS Coordinator', 'Admin'],
    Contractor: ['Requirements'],
};

// ✅ SINGLE SOURCE OF TRUTH for offices
// Offices are determined ONLY by (component + role)
export const OFFICES_BY_COMPONENT_AND_ROLE: Record<string, Record<string, string[]>> = {
    HQ: {
        Requirements: ['OCIO', 'Finance', 'Program Office'],
        'Contracting Office': ['Procurement'],
        'APFS Coordinator': ['OCIO'],
        Admin: ['OCIO', 'Finance', 'Procurement'],
    },

    CBP: {
        Requirements: ['Office of Trade', 'Office of Field Operations'],
        'Contracting Office': ['OIT'],
        'APFS Coordinator': ['Office of Trade'],
        Admin: ['Office of Trade', 'Office of Field Operations', 'OIT'],
    },

    FEMA: {
        Requirements: ['Grants', 'Logistics'],
        'Contracting Office': ['Procurement'],
        'APFS Coordinator': ['Logistics'],
        Admin: ['Procurement', 'Grants', 'Logistics'],
    },

    ICE: {
        Requirements: ['ERO', 'HSI'],
        'Contracting Office': ['Management'],
        'APFS Coordinator': ['Management'],
        Admin: ['ERO', 'HSI', 'Management'],
    },

    TSA: {
        Requirements: ['Security Ops'],
        'Contracting Office': ['Acquisition'],
        'APFS Coordinator': ['IT'],
        Admin: ['Acquisition', 'Security Ops', 'IT'],
    },

    USCG: {
        Requirements: ['Operations'],
        'Contracting Office': ['Acquisition Directorate'],
        'APFS Coordinator': ['C4IT'],
        Admin: ['Acquisition Directorate', 'Operations', 'C4IT'],
    },

    USSS: {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
};
