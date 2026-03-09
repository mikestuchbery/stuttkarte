import { Stop } from './api';

/**
 * Zone Engine for VVS Stuttgart.
 * Calculates zones based on real tariff data when available,
 * otherwise falls back to a heuristic based on stop count.
 */

export interface ZoneInfo {
  count: number;
  list: string[];
}

const ZONE_FALLBACKS: Record<string, string> = {
  'stuttgart': '1',
  'ludwigsburg': '2',
  'esslingen': '2',
  'böblingen': '3',
  'sindelfingen': '3',
  'leonberg': '2',
  'waiblingen': '2',
  'fellbach': '2',
  'flughafen': '2',
  'messe': '2',
  'holzgerlingen': '3',
  'aich': '3',
  'aichtal': '3',
  'metzingen': '5',
  'tübingen': '5',
  'reutlingen': '5',
  'nürtingen': '3',
  'kirchheim': '3',
  'schorndorf': '3',
  'backnang': '3',
  'bietigheim': '3',
  'vaihingen': '4',
  'herrenberg': '3',
  'marbach': '3',
  'winnenden': '3',
  'geislingen': '5',
  'göppingen': '4',
};

export function estimateZones(stops: Stop[]): ZoneInfo {
  if (stops.length < 1) return { count: 1, list: [] };
  
  // 1. Try to use real zone data
  const allZones = new Set<number>();
  let hasRealZones = false;

  stops.forEach(stop => {
    let stopZones = stop.zones;
    
    // Fallback to dictionary if no zones
    if (!stopZones || stopZones.length === 0) {
      const nameLower = stop.name.toLowerCase();
      for (const [key, zone] of Object.entries(ZONE_FALLBACKS)) {
        if (nameLower.includes(key)) {
          stopZones = [zone];
          break;
        }
      }
    }

    if (stopZones && stopZones.length > 0) {
      hasRealZones = true;
      stopZones.forEach(z => {
        const zoneNum = parseInt(z.replace(/\D/g, ''), 10);
        if (!isNaN(zoneNum)) allZones.add(zoneNum);
      });
    }
  });

  if (hasRealZones && allZones.size > 0) {
    const sortedZones = Array.from(allZones).sort((a, b) => a - b);
    const minZone = sortedZones[0];
    const maxZone = sortedZones[sortedZones.length - 1];
    
    // In VVS concentric system, if you go from 1 to 3, you pay for 1, 2, 3.
    // So the count is max - min + 1.
    const count = Math.max(1, Math.min(5, maxZone - minZone + 1));
    
    // Generate the list of zones travelled through
    const list: string[] = [];
    for (let i = minZone; i <= maxZone; i++) {
      list.push(i.toString());
    }
    
    return { count, list };
  }

  // 2. Fallback Heuristic: 
  // Based on the number of unique stops in the journey
  const uniqueStops = new Set(stops.map(s => s.name)).size;
  
  let count = 1;
  if (uniqueStops <= 2) count = 1;
  else if (uniqueStops <= 4) count = 2;
  else if (uniqueStops <= 6) count = 3;
  else count = 5;

  return { count, list: [] };
}
