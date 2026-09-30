import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, FacilityType } from '@prisma/client';

const prisma = new PrismaClient();

interface Row {
  name: string;
  address?: string;
  phoneNumber?: string;
  facilityType: keyof typeof FacilityType;
  latitude: number;
  longitude: number;
  servicesOffered: string[];
  is247: boolean;
  acceptsNhia: boolean;
  isEmergencyReady: boolean;
}

async function main() {
  const file = path.join(__dirname, 'facilities.lagos.json');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Row[];
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const existing = await prisma.facility.findFirst({ where: { name: r.name } });
    if (existing) {
      await prisma.facility.update({ where: { id: existing.id }, data: r });
      updated++;
    } else {
      await prisma.facility.create({ data: r });
      created++;
    }
  }
  console.log(`Import complete: ${created} created, ${updated} updated (${rows.length} total)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
