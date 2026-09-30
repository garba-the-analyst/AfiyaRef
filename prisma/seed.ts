import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed demo facilities in Lagos, Nigeria
  const facilities = [
    {
      name: 'Lagos University Teaching Hospital',
      address: 'Idi-Araba, Surulere, Lagos',
      phoneNumber: '+2341800123456',
      facilityType: 'HOSPITAL' as const,
      latitude: 6.5244,
      longitude: 3.3792,
      servicesOffered: ['Emergency', 'ICU', 'Pediatrics', 'X-Ray', 'Surgery'],
      is247: true,
      acceptsNhia: true,
      isEmergencyReady: true,
    },
    {
      name: 'Reddington Hospital Lekki',
      address: '12 Idowu Martins St, Lekki, Lagos',
      phoneNumber: '+2341800654321',
      facilityType: 'HOSPITAL' as const,
      latitude: 6.4463,
      longitude: 3.4633,
      servicesOffered: ['Emergency', 'ICU', 'Cardiology', 'X-Ray'],
      is247: true,
      acceptsNhia: false,
      isEmergencyReady: true,
    },
    {
      name: 'SynLab Diagnostic Center Ikeja',
      address: 'Allen Avenue, Ikeja, Lagos',
      phoneNumber: '+2341700999888',
      facilityType: 'LAB' as const,
      latitude: 6.6018,
      longitude: 3.3515,
      servicesOffered: ['Blood Test', 'X-Ray', 'MRI', 'Ultrasound'],
      is247: false,
      acceptsNhia: true,
      isEmergencyReady: false,
    },
  ];

  for (const f of facilities) {
    const exists = await prisma.facility.findFirst({ where: { name: f.name } });
    if (!exists) await prisma.facility.create({ data: f });
  }
  console.log('Seed complete:', facilities.length, 'facilities');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
