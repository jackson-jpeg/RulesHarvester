import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// All 13 Federal Circuit Courts
const FEDERAL_CIRCUITS = [
  { id: 'fed-1st', code: 'FED-1ST', name: '1st Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca1.uscourts.gov' },
  { id: 'fed-2nd', code: 'FED-2ND', name: '2nd Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca2.uscourts.gov' },
  { id: 'fed-3rd', code: 'FED-3RD', name: '3rd Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca3.uscourts.gov' },
  { id: 'fed-4th', code: 'FED-4TH', name: '4th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca4.uscourts.gov' },
  { id: 'fed-5th', code: 'FED-5TH', name: '5th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca5.uscourts.gov' },
  { id: 'fed-6th', code: 'FED-6TH', name: '6th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca6.uscourts.gov' },
  { id: 'fed-7th', code: 'FED-7TH', name: '7th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca7.uscourts.gov' },
  { id: 'fed-8th', code: 'FED-8TH', name: '8th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca8.uscourts.gov' },
  { id: 'fed-9th', code: 'FED-9TH', name: '9th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca9.uscourts.gov' },
  { id: 'fed-10th', code: 'FED-10TH', name: '10th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca10.uscourts.gov' },
  { id: 'fed-11th', code: 'FED-11TH', name: '11th Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.ca11.uscourts.gov' },
  { id: 'fed-dc', code: 'FED-DC', name: 'D.C. Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.cadc.uscourts.gov' },
  { id: 'fed-federal', code: 'FED-FED', name: 'Federal Circuit Court of Appeals', type: 'FEDERAL_CIRCUIT' as const, courtWebsite: 'https://www.cafc.uscourts.gov' },
];

// Federal Districts (abbreviated list - key districts)
const FEDERAL_DISTRICTS = [
  // 1st Circuit
  { id: 'dist-ma', code: 'DIST-MA', name: 'District of Massachusetts', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-1st', courtWebsite: 'https://www.mad.uscourts.gov' },
  // 2nd Circuit
  { id: 'dist-ny-s', code: 'DIST-NY-S', name: 'Southern District of New York', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-2nd', courtWebsite: 'https://www.nysd.uscourts.gov' },
  { id: 'dist-ny-e', code: 'DIST-NY-E', name: 'Eastern District of New York', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-2nd', courtWebsite: 'https://www.nyed.uscourts.gov' },
  // 3rd Circuit
  { id: 'dist-de', code: 'DIST-DE', name: 'District of Delaware', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-3rd', courtWebsite: 'https://www.ded.uscourts.gov' },
  { id: 'dist-nj', code: 'DIST-NJ', name: 'District of New Jersey', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-3rd', courtWebsite: 'https://www.njd.uscourts.gov' },
  // 5th Circuit
  { id: 'dist-tx-n', code: 'DIST-TX-N', name: 'Northern District of Texas', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-5th', courtWebsite: 'https://www.txnd.uscourts.gov' },
  { id: 'dist-tx-s', code: 'DIST-TX-S', name: 'Southern District of Texas', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-5th', courtWebsite: 'https://www.txsd.uscourts.gov' },
  // 9th Circuit
  { id: 'dist-ca-n', code: 'DIST-CA-N', name: 'Northern District of California', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-9th', courtWebsite: 'https://www.cand.uscourts.gov' },
  { id: 'dist-ca-c', code: 'DIST-CA-C', name: 'Central District of California', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-9th', courtWebsite: 'https://www.cacd.uscourts.gov' },
  // 11th Circuit
  { id: 'dist-fl-s', code: 'DIST-FL-S', name: 'Southern District of Florida', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-11th', courtWebsite: 'https://www.flsd.uscourts.gov' },
  // DC
  { id: 'dist-dc', code: 'DIST-DC', name: 'District of Columbia', type: 'FEDERAL_DISTRICT' as const, parentId: 'fed-dc', courtWebsite: 'https://www.dcd.uscourts.gov' },
];

// All 50 States
const US_STATES = [
  { id: 'st-al', code: 'ST-AL', name: 'Alabama', type: 'STATE' as const, courtWebsite: 'https://judicial.alabama.gov' },
  { id: 'st-ak', code: 'ST-AK', name: 'Alaska', type: 'STATE' as const, courtWebsite: 'https://courts.alaska.gov' },
  { id: 'st-az', code: 'ST-AZ', name: 'Arizona', type: 'STATE' as const, courtWebsite: 'https://www.azcourts.gov' },
  { id: 'st-ar', code: 'ST-AR', name: 'Arkansas', type: 'STATE' as const, courtWebsite: 'https://www.arcourts.gov' },
  { id: 'st-ca', code: 'ST-CA', name: 'California', type: 'STATE' as const, courtWebsite: 'https://www.courts.ca.gov' },
  { id: 'st-co', code: 'ST-CO', name: 'Colorado', type: 'STATE' as const, courtWebsite: 'https://www.courts.state.co.us' },
  { id: 'st-ct', code: 'ST-CT', name: 'Connecticut', type: 'STATE' as const, courtWebsite: 'https://www.jud.ct.gov' },
  { id: 'st-de', code: 'ST-DE', name: 'Delaware', type: 'STATE' as const, courtWebsite: 'https://courts.delaware.gov' },
  { id: 'st-fl', code: 'ST-FL', name: 'Florida', type: 'STATE' as const, courtWebsite: 'https://www.flcourts.gov' },
  { id: 'st-ga', code: 'ST-GA', name: 'Georgia', type: 'STATE' as const, courtWebsite: 'https://georgiacourts.gov' },
  { id: 'st-hi', code: 'ST-HI', name: 'Hawaii', type: 'STATE' as const, courtWebsite: 'https://www.courts.state.hi.us' },
  { id: 'st-id', code: 'ST-ID', name: 'Idaho', type: 'STATE' as const, courtWebsite: 'https://isc.idaho.gov' },
  { id: 'st-il', code: 'ST-IL', name: 'Illinois', type: 'STATE' as const, courtWebsite: 'https://www.illinoiscourts.gov' },
  { id: 'st-in', code: 'ST-IN', name: 'Indiana', type: 'STATE' as const, courtWebsite: 'https://www.in.gov/courts' },
  { id: 'st-ia', code: 'ST-IA', name: 'Iowa', type: 'STATE' as const, courtWebsite: 'https://www.iowacourts.gov' },
  { id: 'st-ks', code: 'ST-KS', name: 'Kansas', type: 'STATE' as const, courtWebsite: 'https://www.kscourts.org' },
  { id: 'st-ky', code: 'ST-KY', name: 'Kentucky', type: 'STATE' as const, courtWebsite: 'https://courts.ky.gov' },
  { id: 'st-la', code: 'ST-LA', name: 'Louisiana', type: 'STATE' as const, courtWebsite: 'https://www.lasc.org' },
  { id: 'st-me', code: 'ST-ME', name: 'Maine', type: 'STATE' as const, courtWebsite: 'https://www.courts.maine.gov' },
  { id: 'st-md', code: 'ST-MD', name: 'Maryland', type: 'STATE' as const, courtWebsite: 'https://www.mdcourts.gov' },
  { id: 'st-ma', code: 'ST-MA', name: 'Massachusetts', type: 'STATE' as const, courtWebsite: 'https://www.mass.gov/courts' },
  { id: 'st-mi', code: 'ST-MI', name: 'Michigan', type: 'STATE' as const, courtWebsite: 'https://courts.michigan.gov' },
  { id: 'st-mn', code: 'ST-MN', name: 'Minnesota', type: 'STATE' as const, courtWebsite: 'https://www.mncourts.gov' },
  { id: 'st-ms', code: 'ST-MS', name: 'Mississippi', type: 'STATE' as const, courtWebsite: 'https://courts.ms.gov' },
  { id: 'st-mo', code: 'ST-MO', name: 'Missouri', type: 'STATE' as const, courtWebsite: 'https://www.courts.mo.gov' },
  { id: 'st-mt', code: 'ST-MT', name: 'Montana', type: 'STATE' as const, courtWebsite: 'https://courts.mt.gov' },
  { id: 'st-ne', code: 'ST-NE', name: 'Nebraska', type: 'STATE' as const, courtWebsite: 'https://supremecourt.nebraska.gov' },
  { id: 'st-nv', code: 'ST-NV', name: 'Nevada', type: 'STATE' as const, courtWebsite: 'https://nvcourts.gov' },
  { id: 'st-nh', code: 'ST-NH', name: 'New Hampshire', type: 'STATE' as const, courtWebsite: 'https://www.courts.nh.gov' },
  { id: 'st-nj', code: 'ST-NJ', name: 'New Jersey', type: 'STATE' as const, courtWebsite: 'https://www.njcourts.gov' },
  { id: 'st-nm', code: 'ST-NM', name: 'New Mexico', type: 'STATE' as const, courtWebsite: 'https://www.nmcourts.gov' },
  { id: 'st-ny', code: 'ST-NY', name: 'New York', type: 'STATE' as const, courtWebsite: 'https://www.nycourts.gov' },
  { id: 'st-nc', code: 'ST-NC', name: 'North Carolina', type: 'STATE' as const, courtWebsite: 'https://www.nccourts.gov' },
  { id: 'st-nd', code: 'ST-ND', name: 'North Dakota', type: 'STATE' as const, courtWebsite: 'https://www.ndcourts.gov' },
  { id: 'st-oh', code: 'ST-OH', name: 'Ohio', type: 'STATE' as const, courtWebsite: 'https://www.supremecourt.ohio.gov' },
  { id: 'st-ok', code: 'ST-OK', name: 'Oklahoma', type: 'STATE' as const, courtWebsite: 'https://www.oscn.net' },
  { id: 'st-or', code: 'ST-OR', name: 'Oregon', type: 'STATE' as const, courtWebsite: 'https://www.courts.oregon.gov' },
  { id: 'st-pa', code: 'ST-PA', name: 'Pennsylvania', type: 'STATE' as const, courtWebsite: 'https://www.pacourts.us' },
  { id: 'st-ri', code: 'ST-RI', name: 'Rhode Island', type: 'STATE' as const, courtWebsite: 'https://www.courts.ri.gov' },
  { id: 'st-sc', code: 'ST-SC', name: 'South Carolina', type: 'STATE' as const, courtWebsite: 'https://www.sccourts.org' },
  { id: 'st-sd', code: 'ST-SD', name: 'South Dakota', type: 'STATE' as const, courtWebsite: 'https://ujs.sd.gov' },
  { id: 'st-tn', code: 'ST-TN', name: 'Tennessee', type: 'STATE' as const, courtWebsite: 'https://www.tncourts.gov' },
  { id: 'st-tx', code: 'ST-TX', name: 'Texas', type: 'STATE' as const, courtWebsite: 'https://www.txcourts.gov' },
  { id: 'st-ut', code: 'ST-UT', name: 'Utah', type: 'STATE' as const, courtWebsite: 'https://www.utcourts.gov' },
  { id: 'st-vt', code: 'ST-VT', name: 'Vermont', type: 'STATE' as const, courtWebsite: 'https://www.vermontjudiciary.org' },
  { id: 'st-va', code: 'ST-VA', name: 'Virginia', type: 'STATE' as const, courtWebsite: 'https://www.vacourts.gov' },
  { id: 'st-wa', code: 'ST-WA', name: 'Washington', type: 'STATE' as const, courtWebsite: 'https://www.courts.wa.gov' },
  { id: 'st-wv', code: 'ST-WV', name: 'West Virginia', type: 'STATE' as const, courtWebsite: 'https://www.courtswv.gov' },
  { id: 'st-wi', code: 'ST-WI', name: 'Wisconsin', type: 'STATE' as const, courtWebsite: 'https://www.wicourts.gov' },
  { id: 'st-wy', code: 'ST-WY', name: 'Wyoming', type: 'STATE' as const, courtWebsite: 'https://www.courts.state.wy.us' },
];

async function main() {
  console.log('Seeding database...');

  // Seed Federal Circuits first (no parent dependency)
  console.log('Seeding Federal Circuits...');
  for (const circuit of FEDERAL_CIRCUITS) {
    await prisma.jurisdiction.upsert({
      where: { id: circuit.id },
      update: circuit,
      create: {
        ...circuit,
        status: 'IDLE',
        ruleCount: 0,
      },
    });
  }
  console.log(`  Created ${FEDERAL_CIRCUITS.length} Federal Circuits`);

  // Seed Federal Districts (with parent references)
  console.log('Seeding Federal Districts...');
  for (const district of FEDERAL_DISTRICTS) {
    await prisma.jurisdiction.upsert({
      where: { id: district.id },
      update: district,
      create: {
        ...district,
        status: 'IDLE',
        ruleCount: 0,
      },
    });
  }
  console.log(`  Created ${FEDERAL_DISTRICTS.length} Federal Districts`);

  // Seed US States
  console.log('Seeding US States...');
  for (const state of US_STATES) {
    await prisma.jurisdiction.upsert({
      where: { id: state.id },
      update: state,
      create: {
        ...state,
        status: 'IDLE',
        ruleCount: 0,
      },
    });
  }
  console.log(`  Created ${US_STATES.length} US States`);

  const totalCount = FEDERAL_CIRCUITS.length + FEDERAL_DISTRICTS.length + US_STATES.length;
  console.log(`\nDatabase seeded with ${totalCount} jurisdictions!`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
