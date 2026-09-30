import { Router } from 'express';
import { z } from 'zod';
import { searchFacilities } from '../services/facility.service';
import { getRoute } from '../services/routing.service';
import { prisma } from '../lib/prisma';
import { adminMiddleware } from '../middleware/admin';

export const facilityRouter = Router();

const searchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().positive().max(200).default(10),
  service: z.string().optional(),
  emergency_only: z.coerce.boolean().optional(),
  accepts_nhia: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// GET /api/facilities/search?lat=&lng=&radius_km=&service=
facilityRouter.get('/search', async (req, res) => {
  const parsed = searchQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const q = parsed.data;
  try {
    const results = await searchFacilities({
      lat: q.lat,
      lng: q.lng,
      radiusKm: q.radius_km,
      service: q.service,
      emergencyOnly: q.emergency_only,
      acceptsNhia: q.accepts_nhia,
      limit: q.limit,
    });
    res.json({ count: results.length, results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Spatial search failed. Is PostGIS enabled? (see prisma/postgis-init.sql)' });
  }
});

const routeQuery = z.object({
  from_lat: z.coerce.number().min(-90).max(90),
  from_lng: z.coerce.number().min(-180).max(180),
  to_lat: z.coerce.number().min(-90).max(90),
  to_lng: z.coerce.number().min(-180).max(180),
});

// GET /api/facilities/route?from_lat=&from_lng=&to_lat=&to_lng= — OSRM driving route
facilityRouter.get('/route', async (req, res) => {
  const parsed = routeQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const q = parsed.data;
  try {
    const route = await getRoute(
      { lat: q.from_lat, lng: q.from_lng },
      { lat: q.to_lat, lng: q.to_lng },
    );
    res.json(route);
  } catch (e) {
    console.error('[routing]', (e as Error).message);
    res.status(502).json({ error: 'Routing failed' });
  }
});

facilityRouter.get('/:id', async (req, res) => {
  const f = await prisma.facility.findUnique({ where: { id: req.params.id } });
  if (!f) return res.status(404).json({ error: 'Facility not found' });
  res.json(f);
});

facilityRouter.post('/', adminMiddleware, async (req, res) => {
  // Admin-only facility creation
  try {
    const f = await prisma.facility.create({ data: req.body });
    res.status(201).json(f);
  } catch (e: unknown) {
    res.status(400).json({ error: (e as Error).message });
  }
});
