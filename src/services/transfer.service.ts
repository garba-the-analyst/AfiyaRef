import { prisma } from '../lib/prisma';
import { sendSms } from './notify.service';

/** Build an EHR-Lite snapshot for inter-hospital transfer payloads. */
export async function buildEhrSnapshot(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { healthProfile: true, homeHospital: true },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return {
    full_name: user.fullName,
    phone_number: user.phoneNumber,
    dob: user.dob,
    gender: user.gender,
    blood_group: user.healthProfile?.bloodGroup ?? null,
    genotype: user.healthProfile?.genotype ?? null,
    allergies: user.healthProfile?.allergies ?? [],
    chronic_conditions: user.healthProfile?.chronicConditions ?? [],
    emergency_contact: user.healthProfile?.emergencyContactPhone ?? null,
    active_prescriptions: user.healthProfile?.activePrescriptions ?? null,
    insurance_provider: user.insuranceProvider,
    nhia_policy_number: user.nhiaPolicyNumber,
    home_hospital: user.homeHospital
      ? { id: user.homeHospital.id, name: user.homeHospital.name, phone: user.homeHospital.phoneNumber }
      : null,
  };
}

export async function createTransfer(opts: {
  userId: string;
  treatingFacilityId: string;
  nhiaNumberUsed?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: opts.userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const treating = await prisma.facility.findUnique({ where: { id: opts.treatingFacilityId } });
  if (!treating) throw Object.assign(new Error('Treating facility not found'), { status: 404 });

  const snapshot = await buildEhrSnapshot(opts.userId);
  const record = await prisma.crossFacilityTransfer.create({
    data: {
      userId: opts.userId,
      treatingFacilityId: opts.treatingFacilityId,
      homeFacilityId: user.homeHospitalId,
      nhiaNumberUsed: opts.nhiaNumberUsed ?? user.nhiaPolicyNumber,
      status: 'NOTIFIED',
      payload: {
        ehr_snapshot: snapshot,
        treating_facility: { id: treating.id, name: treating.name },
        insurance_validation_request: {
          provider: user.insuranceProvider,
          nhia_policy_number: opts.nhiaNumberUsed ?? user.nhiaPolicyNumber,
        },
      },
    },
  });

  // Dispatch SMS alerts to home facility + patient's emergency contact.
  // Failures never block the check-in itself.
  const homeFacility = user.homeHospitalId
    ? await prisma.facility.findUnique({ where: { id: user.homeHospitalId } })
    : null;
  const profile = await prisma.healthProfile.findUnique({ where: { userId: opts.userId } });
  const alert = `AfiyaRef emergency check-in: ${user.fullName} (${opts.nhiaNumberUsed ?? user.nhiaPolicyNumber ?? 'no NHIA'}) arrived at ${treating.name}. Tracking ${record.id}. EHR + insurance validation shared.`;
  await Promise.all([
    homeFacility?.phoneNumber ? sendSms(homeFacility.phoneNumber, alert) : Promise.resolve(),
    profile?.emergencyContactPhone
      ? sendSms(profile.emergencyContactPhone, `AfiyaRef: ${user.fullName} checked in at ${treating.name} in an emergency. Tracking ${record.id}.`)
      : Promise.resolve(),
  ]);
  console.log(
    `[transfer] NOTIFIED home=${record.homeFacilityId} treating=${record.treatingFacilityId} user=${opts.userId}`,
  );
  return record;
}
