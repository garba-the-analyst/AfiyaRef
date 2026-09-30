-- AfiyaRef PostGIS bootstrap. Run once per database.
-- Usage: psql $DATABASE_URL -f prisma/postgis-init.sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column to facilities (Prisma manages the rest of the table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='facilities' AND column_name='location'
  ) THEN
    ALTER TABLE "facilities"
      ADD COLUMN "location" geography(Point, 4326);
  END IF;
END $$;

-- Keep location in sync from latitude/longitude
CREATE OR REPLACE FUNCTION sync_facility_location() RETURNS trigger AS $$
BEGIN
  NEW."location" := ST_MakePoint(NEW."longitude", NEW."latitude")::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_facility_location ON "facilities";
CREATE TRIGGER trg_sync_facility_location
BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "facilities"
FOR EACH ROW EXECUTE FUNCTION sync_facility_location();

-- Backfill existing rows
UPDATE "facilities"
SET "location" = ST_MakePoint("longitude", "latitude")::geography
WHERE "location" IS NULL;

-- Spatial index for ST_DWithin / ST_Distance queries
CREATE INDEX IF NOT EXISTS idx_facilities_location_gist
  ON "facilities" USING GIST ("location");
CREATE INDEX IF NOT EXISTS idx_facilities_services_gin
  ON "facilities" USING GIN ("services_offered");
