-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('HOSPITAL', 'LAB', 'PHARMACY', 'CLINIC');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('DOCTOR_APPOINTMENT', 'LAB_TEST');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('NOTIFIED', 'ACKNOWLEDGED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" "Gender",
    "insurance_provider" TEXT,
    "nhia_policy_number" TEXT,
    "home_hospital_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_profiles" (
    "user_id" TEXT NOT NULL,
    "blood_group" TEXT,
    "genotype" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chronic_conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emergency_contact_phone" TEXT,
    "active_prescriptions" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone_number" TEXT,
    "facility_type" "FacilityType" NOT NULL DEFAULT 'HOSPITAL',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "services_offered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_24_7" BOOLEAN NOT NULL DEFAULT false,
    "accepts_nhia" BOOLEAN NOT NULL DEFAULT true,
    "is_emergency_ready" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "booking_type" "BookingType" NOT NULL,
    "scheduled_time" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_facility_transfers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "treating_facility_id" TEXT NOT NULL,
    "home_facility_id" TEXT,
    "nhia_number_used" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'NOTIFIED',
    "payload" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_facility_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_nhia_policy_number_key" ON "users"("nhia_policy_number");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_home_hospital_id_fkey" FOREIGN KEY ("home_hospital_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_facility_transfers" ADD CONSTRAINT "cross_facility_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_facility_transfers" ADD CONSTRAINT "cross_facility_transfers_treating_facility_id_fkey" FOREIGN KEY ("treating_facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_facility_transfers" ADD CONSTRAINT "cross_facility_transfers_home_facility_id_fkey" FOREIGN KEY ("home_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
