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
        const type = (point.anyType || point.type || '').toLowerCase();
        const id = point.stateless || (point.ref && point.ref.id) || point.id || '';
        
        // Include actual transit stops, stations, and localities
        const isTransitType = type === 'stop' || type === 'station' || type === 'poi' || type === 'suburb' || type === 'locality';
        
        // Ringfence: VVS area stops usually start with de:081 (Stuttgart Region)
        // We allow some flexibility but prioritize regional IDs
        const isRegional = id.startsWith('de:081') || id.startsWith('081') || !id.includes(':');
        
        return isTransitType && isRegional;
      })
      .map((point: any) => {
        // Extract tariff zones if available
        let zones: string[] = [];
        const rawZones = point.tariffZones || point.tariffZoneList;
        
        if (rawZones) {
          const normalizeZone = (z: any) => {
            const val = (typeof z === 'object' ? (z.zone || z.id) : z).toString().replace(/\D/g, '');
            const num = parseInt(val, 10);
            if (isNaN(num)) return '';
            // VVS 10-based to 1-based conversion
            if (num >= 10) return Math.min(5, Math.floor(num / 10)).toString();
            return Math.min(5, num).toString();
          };

          if (Array.isArray(rawZones)) {
            zones = rawZones.map(normalizeZone);
          } else if (typeof rawZones === 'string') {
            zones = rawZones.split(',').map(z => normalizeZone(z.trim()));
          } else if (rawZones.zone) {
            const zList = Array.isArray(rawZones.zone) ? rawZones.zone : [rawZones.zone];
            zones = zList.map(normalizeZone);
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
      const normalizeZone = (z: any) => {
        const val = (typeof z === 'object' ? (z.zone || z.id) : z).toString().replace(/\D/g, '');
        const num = parseInt(val, 10);
        if (isNaN(num)) return '';
        // VVS 10-based to 1-based conversion
        if (num >= 10) return Math.min(5, Math.floor(num / 10)).toString();
        return Math.min(5, num).toString();
      };

      if (Array.isArray(rawZones)) {
        zones = rawZones.map(normalizeZone);
      } else if (typeof rawZones === 'string') {
        zones = rawZones.split(',').map(z => normalizeZone(z.trim()));
      } else if (rawZones.zone) {
        const zList = Array.isArray(rawZones.zone) ? rawZones.zone : [rawZones.zone];
        zones = zList.map(normalizeZone);
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
