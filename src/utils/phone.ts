/** Normalize Nigerian phone numbers to E.164-ish (+234...) form. */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('0')) p = '+234' + p.slice(1);
  if (/^234\d+$/.test(p)) p = '+' + p;
  return p;
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function telLink(phone: string): string {
  return `tel:${phone}`;
}
