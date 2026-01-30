import { JurisdictionType, JurisdictionStatus, type JurisdictionMeta } from '../types/index.js';

// All 13 Federal Circuit Courts
export const FEDERAL_CIRCUITS: JurisdictionMeta[] = [
  {
    id: 'fed-1st',
    code: 'FED-1ST',
    name: '1st Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca1.uscourts.gov',
  },
  {
    id: 'fed-2nd',
    code: 'FED-2ND',
    name: '2nd Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca2.uscourts.gov',
  },
  {
    id: 'fed-3rd',
    code: 'FED-3RD',
    name: '3rd Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca3.uscourts.gov',
  },
  {
    id: 'fed-4th',
    code: 'FED-4TH',
    name: '4th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca4.uscourts.gov',
  },
  {
    id: 'fed-5th',
    code: 'FED-5TH',
    name: '5th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca5.uscourts.gov',
  },
  {
    id: 'fed-6th',
    code: 'FED-6TH',
    name: '6th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca6.uscourts.gov',
  },
  {
    id: 'fed-7th',
    code: 'FED-7TH',
    name: '7th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca7.uscourts.gov',
  },
  {
    id: 'fed-8th',
    code: 'FED-8TH',
    name: '8th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca8.uscourts.gov',
  },
  {
    id: 'fed-9th',
    code: 'FED-9TH',
    name: '9th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca9.uscourts.gov',
  },
  {
    id: 'fed-10th',
    code: 'FED-10TH',
    name: '10th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca10.uscourts.gov',
  },
  {
    id: 'fed-11th',
    code: 'FED-11TH',
    name: '11th Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.ca11.uscourts.gov',
  },
  {
    id: 'fed-dc',
    code: 'FED-DC',
    name: 'D.C. Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.cadc.uscourts.gov',
  },
  {
    id: 'fed-federal',
    code: 'FED-FED',
    name: 'Federal Circuit Court of Appeals',
    type: JurisdictionType.FEDERAL_CIRCUIT,
    status: JurisdictionStatus.IDLE,
    ruleCount: 0,
    courtWebsite: 'https://www.cafc.uscourts.gov',
  },
];

// All 94 Federal District Courts
export const FEDERAL_DISTRICTS: JurisdictionMeta[] = [
  // 1st Circuit Districts
  { id: 'dist-me', code: 'DIST-ME', name: 'District of Maine', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-1st', courtWebsite: 'https://www.med.uscourts.gov' },
  { id: 'dist-ma', code: 'DIST-MA', name: 'District of Massachusetts', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-1st', courtWebsite: 'https://www.mad.uscourts.gov' },
  { id: 'dist-nh', code: 'DIST-NH', name: 'District of New Hampshire', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-1st', courtWebsite: 'https://www.nhd.uscourts.gov' },
  { id: 'dist-ri', code: 'DIST-RI', name: 'District of Rhode Island', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-1st', courtWebsite: 'https://www.rid.uscourts.gov' },
  { id: 'dist-pr', code: 'DIST-PR', name: 'District of Puerto Rico', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-1st', courtWebsite: 'https://www.prd.uscourts.gov' },

  // 2nd Circuit Districts
  { id: 'dist-ct', code: 'DIST-CT', name: 'District of Connecticut', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-2nd', courtWebsite: 'https://www.ctd.uscourts.gov' },
  { id: 'dist-ny-n', code: 'DIST-NY-N', name: 'Northern District of New York', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-2nd', courtWebsite: 'https://www.nynd.uscourts.gov' },
  { id: 'dist-ny-e', code: 'DIST-NY-E', name: 'Eastern District of New York', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-2nd', courtWebsite: 'https://www.nyed.uscourts.gov' },
  { id: 'dist-ny-s', code: 'DIST-NY-S', name: 'Southern District of New York', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-2nd', courtWebsite: 'https://www.nysd.uscourts.gov' },
  { id: 'dist-ny-w', code: 'DIST-NY-W', name: 'Western District of New York', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-2nd', courtWebsite: 'https://www.nywd.uscourts.gov' },
  { id: 'dist-vt', code: 'DIST-VT', name: 'District of Vermont', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-2nd', courtWebsite: 'https://www.vtd.uscourts.gov' },

  // 3rd Circuit Districts
  { id: 'dist-de', code: 'DIST-DE', name: 'District of Delaware', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-3rd', courtWebsite: 'https://www.ded.uscourts.gov' },
  { id: 'dist-nj', code: 'DIST-NJ', name: 'District of New Jersey', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-3rd', courtWebsite: 'https://www.njd.uscourts.gov' },
  { id: 'dist-pa-e', code: 'DIST-PA-E', name: 'Eastern District of Pennsylvania', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-3rd', courtWebsite: 'https://www.paed.uscourts.gov' },
  { id: 'dist-pa-m', code: 'DIST-PA-M', name: 'Middle District of Pennsylvania', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-3rd', courtWebsite: 'https://www.pamd.uscourts.gov' },
  { id: 'dist-pa-w', code: 'DIST-PA-W', name: 'Western District of Pennsylvania', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-3rd', courtWebsite: 'https://www.pawd.uscourts.gov' },
  { id: 'dist-vi', code: 'DIST-VI', name: 'District of the Virgin Islands', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-3rd', courtWebsite: 'https://www.vid.uscourts.gov' },

  // 4th Circuit Districts
  { id: 'dist-md', code: 'DIST-MD', name: 'District of Maryland', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.mdd.uscourts.gov' },
  { id: 'dist-nc-e', code: 'DIST-NC-E', name: 'Eastern District of North Carolina', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.nced.uscourts.gov' },
  { id: 'dist-nc-m', code: 'DIST-NC-M', name: 'Middle District of North Carolina', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.ncmd.uscourts.gov' },
  { id: 'dist-nc-w', code: 'DIST-NC-W', name: 'Western District of North Carolina', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.ncwd.uscourts.gov' },
  { id: 'dist-sc', code: 'DIST-SC', name: 'District of South Carolina', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.scd.uscourts.gov' },
  { id: 'dist-va-e', code: 'DIST-VA-E', name: 'Eastern District of Virginia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.vaed.uscourts.gov' },
  { id: 'dist-va-w', code: 'DIST-VA-W', name: 'Western District of Virginia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.vawd.uscourts.gov' },
  { id: 'dist-wv-n', code: 'DIST-WV-N', name: 'Northern District of West Virginia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.wvnd.uscourts.gov' },
  { id: 'dist-wv-s', code: 'DIST-WV-S', name: 'Southern District of West Virginia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-4th', courtWebsite: 'https://www.wvsd.uscourts.gov' },

  // 5th Circuit Districts
  { id: 'dist-la-e', code: 'DIST-LA-E', name: 'Eastern District of Louisiana', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.laed.uscourts.gov' },
  { id: 'dist-la-m', code: 'DIST-LA-M', name: 'Middle District of Louisiana', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.lamd.uscourts.gov' },
  { id: 'dist-la-w', code: 'DIST-LA-W', name: 'Western District of Louisiana', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.lawd.uscourts.gov' },
  { id: 'dist-ms-n', code: 'DIST-MS-N', name: 'Northern District of Mississippi', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.msnd.uscourts.gov' },
  { id: 'dist-ms-s', code: 'DIST-MS-S', name: 'Southern District of Mississippi', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.mssd.uscourts.gov' },
  { id: 'dist-tx-n', code: 'DIST-TX-N', name: 'Northern District of Texas', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.txnd.uscourts.gov' },
  { id: 'dist-tx-e', code: 'DIST-TX-E', name: 'Eastern District of Texas', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.txed.uscourts.gov' },
  { id: 'dist-tx-s', code: 'DIST-TX-S', name: 'Southern District of Texas', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.txsd.uscourts.gov' },
  { id: 'dist-tx-w', code: 'DIST-TX-W', name: 'Western District of Texas', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-5th', courtWebsite: 'https://www.txwd.uscourts.gov' },

  // 6th Circuit Districts
  { id: 'dist-ky-e', code: 'DIST-KY-E', name: 'Eastern District of Kentucky', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.kyed.uscourts.gov' },
  { id: 'dist-ky-w', code: 'DIST-KY-W', name: 'Western District of Kentucky', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.kywd.uscourts.gov' },
  { id: 'dist-mi-e', code: 'DIST-MI-E', name: 'Eastern District of Michigan', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.mied.uscourts.gov' },
  { id: 'dist-mi-w', code: 'DIST-MI-W', name: 'Western District of Michigan', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.miwd.uscourts.gov' },
  { id: 'dist-oh-n', code: 'DIST-OH-N', name: 'Northern District of Ohio', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.ohnd.uscourts.gov' },
  { id: 'dist-oh-s', code: 'DIST-OH-S', name: 'Southern District of Ohio', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.ohsd.uscourts.gov' },
  { id: 'dist-tn-e', code: 'DIST-TN-E', name: 'Eastern District of Tennessee', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.tned.uscourts.gov' },
  { id: 'dist-tn-m', code: 'DIST-TN-M', name: 'Middle District of Tennessee', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.tnmd.uscourts.gov' },
  { id: 'dist-tn-w', code: 'DIST-TN-W', name: 'Western District of Tennessee', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-6th', courtWebsite: 'https://www.tnwd.uscourts.gov' },

  // 7th Circuit Districts
  { id: 'dist-il-n', code: 'DIST-IL-N', name: 'Northern District of Illinois', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-7th', courtWebsite: 'https://www.ilnd.uscourts.gov' },
  { id: 'dist-il-c', code: 'DIST-IL-C', name: 'Central District of Illinois', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-7th', courtWebsite: 'https://www.ilcd.uscourts.gov' },
  { id: 'dist-il-s', code: 'DIST-IL-S', name: 'Southern District of Illinois', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-7th', courtWebsite: 'https://www.ilsd.uscourts.gov' },
  { id: 'dist-in-n', code: 'DIST-IN-N', name: 'Northern District of Indiana', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-7th', courtWebsite: 'https://www.innd.uscourts.gov' },
  { id: 'dist-in-s', code: 'DIST-IN-S', name: 'Southern District of Indiana', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-7th', courtWebsite: 'https://www.insd.uscourts.gov' },
  { id: 'dist-wi-e', code: 'DIST-WI-E', name: 'Eastern District of Wisconsin', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-7th', courtWebsite: 'https://www.wied.uscourts.gov' },
  { id: 'dist-wi-w', code: 'DIST-WI-W', name: 'Western District of Wisconsin', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-7th', courtWebsite: 'https://www.wiwd.uscourts.gov' },

  // 8th Circuit Districts
  { id: 'dist-ar-e', code: 'DIST-AR-E', name: 'Eastern District of Arkansas', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.ared.uscourts.gov' },
  { id: 'dist-ar-w', code: 'DIST-AR-W', name: 'Western District of Arkansas', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.arwd.uscourts.gov' },
  { id: 'dist-ia-n', code: 'DIST-IA-N', name: 'Northern District of Iowa', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.iand.uscourts.gov' },
  { id: 'dist-ia-s', code: 'DIST-IA-S', name: 'Southern District of Iowa', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.iasd.uscourts.gov' },
  { id: 'dist-mn', code: 'DIST-MN', name: 'District of Minnesota', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.mnd.uscourts.gov' },
  { id: 'dist-mo-e', code: 'DIST-MO-E', name: 'Eastern District of Missouri', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.moed.uscourts.gov' },
  { id: 'dist-mo-w', code: 'DIST-MO-W', name: 'Western District of Missouri', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.mowd.uscourts.gov' },
  { id: 'dist-ne', code: 'DIST-NE', name: 'District of Nebraska', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.ned.uscourts.gov' },
  { id: 'dist-nd', code: 'DIST-ND', name: 'District of North Dakota', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.ndd.uscourts.gov' },
  { id: 'dist-sd', code: 'DIST-SD', name: 'District of South Dakota', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-8th', courtWebsite: 'https://www.sdd.uscourts.gov' },

  // 9th Circuit Districts
  { id: 'dist-ak', code: 'DIST-AK', name: 'District of Alaska', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.akd.uscourts.gov' },
  { id: 'dist-az', code: 'DIST-AZ', name: 'District of Arizona', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.azd.uscourts.gov' },
  { id: 'dist-ca-n', code: 'DIST-CA-N', name: 'Northern District of California', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.cand.uscourts.gov' },
  { id: 'dist-ca-e', code: 'DIST-CA-E', name: 'Eastern District of California', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.caed.uscourts.gov' },
  { id: 'dist-ca-c', code: 'DIST-CA-C', name: 'Central District of California', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.cacd.uscourts.gov' },
  { id: 'dist-ca-s', code: 'DIST-CA-S', name: 'Southern District of California', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.casd.uscourts.gov' },
  { id: 'dist-gu', code: 'DIST-GU', name: 'District of Guam', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.gud.uscourts.gov' },
  { id: 'dist-hi', code: 'DIST-HI', name: 'District of Hawaii', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.hid.uscourts.gov' },
  { id: 'dist-id', code: 'DIST-ID', name: 'District of Idaho', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.idd.uscourts.gov' },
  { id: 'dist-mt', code: 'DIST-MT', name: 'District of Montana', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.mtd.uscourts.gov' },
  { id: 'dist-nv', code: 'DIST-NV', name: 'District of Nevada', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.nvd.uscourts.gov' },
  { id: 'dist-mp', code: 'DIST-MP', name: 'District of Northern Mariana Islands', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.nmid.uscourts.gov' },
  { id: 'dist-or', code: 'DIST-OR', name: 'District of Oregon', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.ord.uscourts.gov' },
  { id: 'dist-wa-e', code: 'DIST-WA-E', name: 'Eastern District of Washington', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.waed.uscourts.gov' },
  { id: 'dist-wa-w', code: 'DIST-WA-W', name: 'Western District of Washington', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-9th', courtWebsite: 'https://www.wawd.uscourts.gov' },

  // 10th Circuit Districts
  { id: 'dist-co', code: 'DIST-CO', name: 'District of Colorado', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.cod.uscourts.gov' },
  { id: 'dist-ks', code: 'DIST-KS', name: 'District of Kansas', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.ksd.uscourts.gov' },
  { id: 'dist-nm', code: 'DIST-NM', name: 'District of New Mexico', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.nmd.uscourts.gov' },
  { id: 'dist-ok-n', code: 'DIST-OK-N', name: 'Northern District of Oklahoma', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.oknd.uscourts.gov' },
  { id: 'dist-ok-e', code: 'DIST-OK-E', name: 'Eastern District of Oklahoma', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.oked.uscourts.gov' },
  { id: 'dist-ok-w', code: 'DIST-OK-W', name: 'Western District of Oklahoma', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.okwd.uscourts.gov' },
  { id: 'dist-ut', code: 'DIST-UT', name: 'District of Utah', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.utd.uscourts.gov' },
  { id: 'dist-wy', code: 'DIST-WY', name: 'District of Wyoming', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-10th', courtWebsite: 'https://www.wyd.uscourts.gov' },

  // 11th Circuit Districts
  { id: 'dist-al-n', code: 'DIST-AL-N', name: 'Northern District of Alabama', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.alnd.uscourts.gov' },
  { id: 'dist-al-m', code: 'DIST-AL-M', name: 'Middle District of Alabama', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.almd.uscourts.gov' },
  { id: 'dist-al-s', code: 'DIST-AL-S', name: 'Southern District of Alabama', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.alsd.uscourts.gov' },
  { id: 'dist-fl-n', code: 'DIST-FL-N', name: 'Northern District of Florida', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.flnd.uscourts.gov' },
  { id: 'dist-fl-m', code: 'DIST-FL-M', name: 'Middle District of Florida', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.flmd.uscourts.gov' },
  { id: 'dist-fl-s', code: 'DIST-FL-S', name: 'Southern District of Florida', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.flsd.uscourts.gov' },
  { id: 'dist-ga-n', code: 'DIST-GA-N', name: 'Northern District of Georgia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.gand.uscourts.gov' },
  { id: 'dist-ga-m', code: 'DIST-GA-M', name: 'Middle District of Georgia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.gamd.uscourts.gov' },
  { id: 'dist-ga-s', code: 'DIST-GA-S', name: 'Southern District of Georgia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-11th', courtWebsite: 'https://www.gasd.uscourts.gov' },

  // D.C. Circuit District
  { id: 'dist-dc', code: 'DIST-DC', name: 'District of Columbia', type: JurisdictionType.FEDERAL_DISTRICT, status: JurisdictionStatus.IDLE, ruleCount: 0, parentId: 'fed-dc', courtWebsite: 'https://www.dcd.uscourts.gov' },
];

// All 50 States + Territories
export const US_STATES: JurisdictionMeta[] = [
  { id: 'st-al', code: 'ST-AL', name: 'Alabama', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://judicial.alabama.gov' },
  { id: 'st-ak', code: 'ST-AK', name: 'Alaska', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://courts.alaska.gov' },
  { id: 'st-az', code: 'ST-AZ', name: 'Arizona', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.azcourts.gov' },
  { id: 'st-ar', code: 'ST-AR', name: 'Arkansas', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.arcourts.gov' },
  { id: 'st-ca', code: 'ST-CA', name: 'California', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.ca.gov' },
  { id: 'st-co', code: 'ST-CO', name: 'Colorado', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.state.co.us' },
  { id: 'st-ct', code: 'ST-CT', name: 'Connecticut', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.jud.ct.gov' },
  { id: 'st-de', code: 'ST-DE', name: 'Delaware', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://courts.delaware.gov' },
  { id: 'st-fl', code: 'ST-FL', name: 'Florida', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.flcourts.gov' },
  { id: 'st-ga', code: 'ST-GA', name: 'Georgia', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://georgiacourts.gov' },
  { id: 'st-hi', code: 'ST-HI', name: 'Hawaii', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.state.hi.us' },
  { id: 'st-id', code: 'ST-ID', name: 'Idaho', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://isc.idaho.gov' },
  { id: 'st-il', code: 'ST-IL', name: 'Illinois', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.illinoiscourts.gov' },
  { id: 'st-in', code: 'ST-IN', name: 'Indiana', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.in.gov/courts' },
  { id: 'st-ia', code: 'ST-IA', name: 'Iowa', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.iowacourts.gov' },
  { id: 'st-ks', code: 'ST-KS', name: 'Kansas', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.kscourts.org' },
  { id: 'st-ky', code: 'ST-KY', name: 'Kentucky', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://courts.ky.gov' },
  { id: 'st-la', code: 'ST-LA', name: 'Louisiana', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.lasc.org' },
  { id: 'st-me', code: 'ST-ME', name: 'Maine', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.maine.gov' },
  { id: 'st-md', code: 'ST-MD', name: 'Maryland', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.mdcourts.gov' },
  { id: 'st-ma', code: 'ST-MA', name: 'Massachusetts', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.mass.gov/courts' },
  { id: 'st-mi', code: 'ST-MI', name: 'Michigan', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://courts.michigan.gov' },
  { id: 'st-mn', code: 'ST-MN', name: 'Minnesota', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.mncourts.gov' },
  { id: 'st-ms', code: 'ST-MS', name: 'Mississippi', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://courts.ms.gov' },
  { id: 'st-mo', code: 'ST-MO', name: 'Missouri', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.mo.gov' },
  { id: 'st-mt', code: 'ST-MT', name: 'Montana', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://courts.mt.gov' },
  { id: 'st-ne', code: 'ST-NE', name: 'Nebraska', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://supremecourt.nebraska.gov' },
  { id: 'st-nv', code: 'ST-NV', name: 'Nevada', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://nvcourts.gov' },
  { id: 'st-nh', code: 'ST-NH', name: 'New Hampshire', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.nh.gov' },
  { id: 'st-nj', code: 'ST-NJ', name: 'New Jersey', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.njcourts.gov' },
  { id: 'st-nm', code: 'ST-NM', name: 'New Mexico', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.nmcourts.gov' },
  { id: 'st-ny', code: 'ST-NY', name: 'New York', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.nycourts.gov' },
  { id: 'st-nc', code: 'ST-NC', name: 'North Carolina', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.nccourts.gov' },
  { id: 'st-nd', code: 'ST-ND', name: 'North Dakota', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.ndcourts.gov' },
  { id: 'st-oh', code: 'ST-OH', name: 'Ohio', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.supremecourt.ohio.gov' },
  { id: 'st-ok', code: 'ST-OK', name: 'Oklahoma', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.oscn.net' },
  { id: 'st-or', code: 'ST-OR', name: 'Oregon', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.oregon.gov' },
  { id: 'st-pa', code: 'ST-PA', name: 'Pennsylvania', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.pacourts.us' },
  { id: 'st-ri', code: 'ST-RI', name: 'Rhode Island', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.ri.gov' },
  { id: 'st-sc', code: 'ST-SC', name: 'South Carolina', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.sccourts.org' },
  { id: 'st-sd', code: 'ST-SD', name: 'South Dakota', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://ujs.sd.gov' },
  { id: 'st-tn', code: 'ST-TN', name: 'Tennessee', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.tncourts.gov' },
  { id: 'st-tx', code: 'ST-TX', name: 'Texas', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.txcourts.gov' },
  { id: 'st-ut', code: 'ST-UT', name: 'Utah', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.utcourts.gov' },
  { id: 'st-vt', code: 'ST-VT', name: 'Vermont', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.vermontjudiciary.org' },
  { id: 'st-va', code: 'ST-VA', name: 'Virginia', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.vacourts.gov' },
  { id: 'st-wa', code: 'ST-WA', name: 'Washington', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.wa.gov' },
  { id: 'st-wv', code: 'ST-WV', name: 'West Virginia', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courtswv.gov' },
  { id: 'st-wi', code: 'ST-WI', name: 'Wisconsin', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.wicourts.gov' },
  { id: 'st-wy', code: 'ST-WY', name: 'Wyoming', type: JurisdictionType.STATE, status: JurisdictionStatus.IDLE, ruleCount: 0, courtWebsite: 'https://www.courts.state.wy.us' },
];

// Combined list of all jurisdictions
export const ALL_JURISDICTIONS: JurisdictionMeta[] = [
  ...FEDERAL_CIRCUITS,
  ...FEDERAL_DISTRICTS,
  ...US_STATES,
];

// Lookup maps for quick access
export const JURISDICTION_BY_ID = new Map<string, JurisdictionMeta>(
  ALL_JURISDICTIONS.map((j) => [j.id, j])
);

export const JURISDICTION_BY_CODE = new Map<string, JurisdictionMeta>(
  ALL_JURISDICTIONS.map((j) => [j.code, j])
);

// Circuit to districts mapping
export const CIRCUIT_DISTRICTS = new Map<string, JurisdictionMeta[]>();
for (const district of FEDERAL_DISTRICTS) {
  if (district.parentId) {
    const existing = CIRCUIT_DISTRICTS.get(district.parentId) || [];
    existing.push(district);
    CIRCUIT_DISTRICTS.set(district.parentId, existing);
  }
}

// Statistics
export const JURISDICTION_STATS = {
  totalJurisdictions: ALL_JURISDICTIONS.length,
  federalCircuits: FEDERAL_CIRCUITS.length,
  federalDistricts: FEDERAL_DISTRICTS.length,
  states: US_STATES.length,
};
