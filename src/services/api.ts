export interface Stop {
  id: string;
  name: string;
  type: string;
  zones?: string[];
}

export async function searchStops(query: string, signal?: AbortSignal): Promise<Stop[]> {
  if (query.length < 2) return [];

  try {
    const url = `/api/vvs/stops?name=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal });
    const data = await response.json();

    if (!data.stopFinder || !data.stopFinder.points) return [];

    let points: any[] = [];
    const rawPoints = data.stopFinder.points;

    if (Array.isArray(rawPoints)) {
      points = rawPoints;
    } else if (rawPoints.point) {
      points = Array.isArray(rawPoints.point) ? rawPoints.point : [rawPoints.point];
    } else {
      // Single point object that isn't in an array and doesn't have a .point wrapper
      points = [rawPoints];
    }

    return points
      .filter((point: any) => {
        const type = point.anyType || point.type;
        return type === 'stop' || type === 'poi' || type === 'address';
      })
      .map((point: any) => {
        // Extract tariff zones if available
        let zones: string[] = [];
        const rawZones = point.tariffZones || point.tariffZoneList;
        
        if (rawZones) {
          if (Array.isArray(rawZones)) {
            zones = rawZones.map((z: any) => (z.zone || z.id || z.toString()).replace(/\D/g, ''));
          } else if (typeof rawZones === 'string') {
            zones = rawZones.split(',').map(z => z.trim().replace(/\D/g, ''));
          } else if (rawZones.zone) {
            const zList = Array.isArray(rawZones.zone) ? rawZones.zone : [rawZones.zone];
            zones = zList.map((z: any) => (typeof z === 'object' ? (z.zone || z.id) : z).toString().replace(/\D/g, ''));
          }
        }

        return {
          id: point.stateless || (point.ref && point.ref.id) || point.id || `stop-${Math.random()}`,
          name: point.name,
          type: point.anyType || point.type,
          zones: zones.filter(z => z).length > 0 ? zones.filter(z => z) : undefined
        };
      });
  } catch (error) {
    console.error('Error fetching stops:', error);
    return [];
  }
}

export async function getNearestStop(lat: number, lon: number): Promise<Stop | null> {
  try {
    const url = `/api/vvs/nearest?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.coordResponse || !data.coordResponse.pointList) return null;

    const points = data.coordResponse.pointList;
    const point = Array.isArray(points) ? points[0] : points.point;

    if (!point) return null;

    // Extract tariff zones if available
    let zones: string[] = [];
    const rawZones = point.tariffZones || point.tariffZoneList;
    
    if (rawZones) {
      if (Array.isArray(rawZones)) {
        zones = rawZones.map((z: any) => (z.zone || z.id || z.toString()).replace(/\D/g, ''));
      } else if (typeof rawZones === 'string') {
        zones = rawZones.split(',').map(z => z.trim().replace(/\D/g, ''));
      } else if (rawZones.zone) {
        const zList = Array.isArray(rawZones.zone) ? rawZones.zone : [rawZones.zone];
        zones = zList.map((z: any) => (typeof z === 'object' ? (z.zone || z.id) : z).toString().replace(/\D/g, ''));
      }
    }

    return {
      id: point.stateless || (point.ref && point.ref.id) || point.id,
      name: point.name,
      type: point.anyType || point.type || 'stop',
      zones: zones.filter(z => z).length > 0 ? zones.filter(z => z) : undefined
    };
  } catch (error) {
    console.error('Error fetching nearest stop:', error);
    return null;
  }
}
