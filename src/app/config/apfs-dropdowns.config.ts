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
    'DHS HQ': {
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
    'CBP/Air and Marine': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/SOG': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/BLW': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/Del Rio Sector': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/EIT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/El Paso Sector': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/ELC': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/Laredo': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/Marfa Sector': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/Rio Grande Valley Se': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/San Diego Sector': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/SWB': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/BP/TCA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/Facilities Managemen': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/HQ': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/HRM': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/IA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/INA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/National Air Trainin': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/National Logistics C': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/Office of Administra': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/Office of Air and Ma': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/Office of Intelligen': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/Office of Technology': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OFO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/BEMS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/CSPO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },

    'CBP/OIT/EDME': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/EDME/EDCOG': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],

        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/ENTS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/LSS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/LSS/ITB': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],

        'APFS Coordinator': ['CIO'],

        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/PSPO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],


        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/TASPO': {
        Requirements: ['CIO'],

        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],

        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/WM': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OIT/WSPO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],

        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OPA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],

        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OTD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],

        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/SBI': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],

        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/CWMD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],

        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/CISA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/OLA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/OPO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/OPS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/S&T': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },

    'DHS HQ/CFO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/CRCL': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/OPA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/PLCY': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/PRIV': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/BPB': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/CHELTENHAM': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/Charleston': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/DD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/DO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/FAD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/FMD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },

    'FLETC/GLD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/HR': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/ITSD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/LOGD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/PD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/SD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'FLETC/TRACOM': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/OD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/OPLA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/M&A/CFO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/M&A/CIO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/HSI/INT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/OPR': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/FAMS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/CIO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Inspection': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/CFO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Security Capability': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/CAO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Human Capital': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OSPIE': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Security Operations': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Public Affairs': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'USCG/ALC': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'USCG/CG-C5I': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'USCG/CG-HCA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'USCG/SFLC': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },

    'USCG/LOGCOM': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OIA': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Administrator': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Civil Rights': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Claims': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OCR/OTT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OAPM': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OIT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/HSI': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/ERO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OC/JOD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/OGC': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OTD': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/LAX': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/Global Strategies': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/MGMT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'USCIS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'USCG/CG-SHORE': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/M&A/OAQ': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ACFS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/OS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/M&A': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/OD/OFTP': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'ICE/OCRC': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'OIG': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'CBP/OPS SUPT': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/OHS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ/MIL': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/ESVP': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OOI': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'HS HQ/OSLLE': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/TSA/COS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'TSA/OS': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },
    'DHS HQ CPO': {
        Requirements: ['CIO'],
        'Contracting Office': ['SSD'],
        'APFS Coordinator': ['CIO'],
        Admin: ['CIO', 'SSD', 'Finance'],
    },

    /*  





*/




}




