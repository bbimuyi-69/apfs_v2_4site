export interface OptionItem {
    value: string;
    label: string;
}

export const APFS_YES_NO_UNKNOWN: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'YES', label: 'Yes' },
    { value: 'NO', label: 'No' },
    { value: 'TBD', label: 'TBD' },
];

export const APFS_PROGRAM_LEVELS: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'LEVEL_1', label: 'Level 1' },
    { value: 'LEVEL_2', label: 'Level 2' },
    { value: 'LEVEL_3', label: 'Level 3' },
];

export const APFS_DOLLAR_RANGES: OptionItem[] = [
    { value: '', label: '----------' },
    { value: '0_250K', label: '$0 - $250K' },
    { value: '250K_1M', label: '$250K - $1M' },
    { value: '1M_5M', label: '$1M - $5M' },
    { value: '5M_10M', label: '$5M - $10M' },
    { value: '10M_PLUS', label: '$10M+' },
];

export const APFS_COMPETITIVE: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'FULL_OPEN', label: 'Full & Open Competition' },
    { value: 'SET_ASIDE', label: 'Set-Aside' },
    { value: 'SOLE_SOURCE', label: 'Sole Source' },
    { value: 'TBD', label: 'TBD' },
];

export const APFS_CONTRACT_STATUS: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'NEW', label: 'New' },
    { value: 'RECOMPETE', label: 'Re-compete' },
    { value: 'BRIDGE', label: 'Bridge' },
    { value: 'TBD', label: 'TBD' },
];

export const APFS_CONTRACT_TYPES: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'FFP', label: 'Firm-Fixed-Price (FFP)' },
    { value: 'T_M', label: 'Time & Materials (T&M)' },
    { value: 'COST', label: 'Cost-Reimbursement' },
    { value: 'IDIQ', label: 'IDIQ' },
    { value: 'BPA', label: 'BPA' },
];

export const APFS_STRATEGIC_SOURCING_VEHICLES: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'GSA_SCHEDULE', label: 'GSA Schedule' },
    { value: 'GWAC', label: 'Government-Wide Acquisition Contract (GWAC)' },
    { value: 'IDIQ', label: 'IDIQ' },
    { value: 'BPA', label: 'BPA' },
    { value: 'SEWP', label: 'NASA SEWP' },
    { value: 'ALLIANT', label: 'GSA Alliant' },
    { value: 'OASIS', label: 'GSA OASIS' },
    { value: 'OTHER', label: 'Other' },
];


export const APFS_TYPE_OF_AWARD: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'NEW_AWARD', label: 'New Award' },
    { value: 'MODIFICATION', label: 'Modification' },
    { value: 'TASK_ORDER', label: 'Task Order' },
    { value: 'DELIVERY_ORDER', label: 'Delivery Order' },
    { value: 'TBD', label: 'TBD' },
];

export const APFS_SMALL_BUSINESS_SET_ASIDE: OptionItem[] = [
    { value: '', label: 'N/A' },
    { value: 'TOTAL', label: 'Total Set-Aside' },
    { value: 'PARTIAL', label: 'Partial Set-Aside' },
    { value: 'HUBZONE', label: 'HUBZone' },
    { value: 'SDVOSB', label: 'SDVOSB' },
    { value: 'WOSB', label: 'WOSB/EDWOSB' },
    { value: '8A', label: '8(a)' },
];

export const APFS_SMALL_BUSINESS_PROGRAM: OptionItem[] = [
    { value: '', label: '----------' },
    { value: '8A', label: '8(a)' },
    { value: 'HUBZONE', label: 'HUBZone' },
    { value: 'SDVOSB', label: 'SDVOSB' },
    { value: 'WOSB', label: 'WOSB/EDWOSB' },
];

export const APFS_FISCAL_YEARS = (() => {
    const thisYear = new Date().getFullYear();
    const start = thisYear;            // tweak if APFS uses FY current+N
    const years = Array.from({ length: 6 }, (_, i) => start + i);
    return [{ value: '', label: '----------' }, ...years.map(y => ({ value: String(y), label: `FY ${y}` }))];
})();

//NAICS Codes truncated for brevity
export const APFS_NAICS_CODES: OptionItem[] = [
    { value: '', label: 'Select…' },
    { value: '111110', label: '111110 — Soybean Farming' },
    { value: '111120', label: '111120 — Oilseed (except Soybean) Farming' },
    { value: '111130', label: '111130 — Dry Pea and Bean Farming' },
    { value: '111140', label: '111140 — Wheat Farming' },
    { value: '111150', label: '111150 — Corn Farming' },
    { value: '111160', label: '111160 — Rice Farming' },
    { value: '111191', label: '111191 — Oilseed and Grain Combination Farming' },
    { value: '111199', label: '111199 — All Other Grain Farming' },
    { value: '111211', label: '111211 — Potato Farming' },
];


export const US_STATES_WITH_NA: OptionItem[] = [
    { value: '', label: '----------' },
    { value: 'NA', label: 'Not Applicable' },
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'DC', label: 'District of Columbia' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
];
