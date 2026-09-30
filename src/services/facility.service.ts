import { prisma } from '../lib/prisma';

export interface FacilitySearchParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  service?: string;
  emergencyOnly?: boolean;
  acceptsNhia?: boolean;
  limit?: number;
}

export interface FacilityResult {
  id: string;
  name: string;
  phone_number: string | null;
  address: string | null;
  services_offered: string[];
  distance_km: number;
  latitude: number;
  longitude: number;
}

/**
 * Geo-proximity search using PostGIS ST_DWithin + ST_Distance.
 * Mirrors the spec SQL. Falls back to Prisma $queryRawUnsafe with params.
 */
export async function searchFacilities(p: FacilitySearchParams): Promise<FacilityResult[]> {
  const radiusM = (p.radiusKm ?? 10) * 1000;
  const limit = Math.min(p.limit ?? 10, 50);

  const conditions: string[] = [
    `ST_DWithin("location"::geography, ST_MakePoint($2, $1)::geography, $3)`,
    `"is_active" = TRUE`,
  ];
  const values: unknown[] = [p.lat, p.lng, radiusM];
  let idx = 4;

  if (p.service) {
    conditions.push(`$${idx} = ANY("services_offered")`);
    values.push(p.service);
    idx++;
  }
  if (p.emergencyOnly) {
    conditions.push(`"is_emergency_ready" = TRUE`);
  }
  if (p.acceptsNhia !== undefined) {
    conditions.push(`"accepts_nhia" = $${idx}`);
    values.push(p.acceptsNhia);
    idx++;
  }

  const sql = `
    SELECT id, name, phone_number, address, services_offered,
           latitude, longitude,
           ST_Distance("location"::geography, ST_MakePoint($2, $1)::geography) / 1000 AS distance_km
    FROM "facilities"
    WHERE ${conditions.join(' AND ')}
    ORDER BY distance_km ASC
    LIMIT $${idx};
  `;
  values.push(limit);

  const rows = await prisma.$queryRawUnsafe<FacilityResult[]>(sql, ...values);
  return rows.map((r) => ({ ...r, distance_km: Number(r.distance_km) }));
}
