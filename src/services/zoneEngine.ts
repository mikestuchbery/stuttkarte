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
  'hbf': '1',
  'hauptbahnhof': '1',
  'schlossplatz': '1',
  'charlottenplatz': '1',
  'stadtbibliothek': '1',
  'neckarpark': '1',
  'wilhelma': '1',
  'killesberg': '1',
  'degerloch': '1',
  'möhringen': '1',
  'vaihingen': '1',
  'zuffenhausen': '1',
  'feuerbach': '1',
  'cannstatt': '1',
  'ludwigsburg': '2',
  'esslingen': '2',
  'fellbach': '2',
  'waiblingen': '2',
  'leonberg': '2',
  'gerlingen': '2',
  'ditzingen': '2',
  'korntal': '2',
  'münchingen': '2',
  'stetten': '2',
  'musberg': '2',
  'leinfelden': '2',
  'echterdingen': '2',
  'flughafen': '2',
  'messe': '2',
  'harthausen': '2',
  'ostfildern': '2',
  'ruit': '2',
  'nellingen': '2',
  'böblingen': '3',
  'sindelfingen': '3',
  'holzgerlingen': '3',
  'nürtingen': '3',
  'kirchheim': '3',
  'schorndorf': '3',
  'backnang': '3',
  'bietigheim': '3',
  'herrenberg': '3',
  'marbach': '3',
  'winnenden': '3',
  'denkendorf': '3',
  'neuhausen': '3',
  'aich': '3',
  'aichtal': '3',
  'vaihingen an der enz': '4',
  'göppingen': '4',
  'metzingen': '5',
  'tübingen': '5',
  'reutlingen': '5',
  'geislingen': '5',
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
  // If we have no real zones, we try to guess based on common city names
  // or just use a slightly smarter stop-count heuristic.
  const uniqueStops = new Set(stops.map(s => s.name)).size;
  const stopNames = stops.map(s => s.name.toLowerCase());
  
  // Check if any stop is outside Stuttgart (Zone 1)
  const hasStuttgart = stopNames.some(n => n.includes('stuttgart') || n.includes('hbf') || n.includes('hbf'));
  const hasOutside = stopNames.some(n => !n.includes('stuttgart') && !n.includes('hbf'));

  let count = 1;
  if (uniqueStops <= 1) {
    count = 1;
  } else if (hasStuttgart && hasOutside) {
    // If one is in Stuttgart and one is outside, it's at least 2 zones
    count = Math.max(2, Math.min(5, uniqueStops - 1));
  } else if (uniqueStops >= 5) {
    count = 3;
  } else if (uniqueStops >= 3) {
    count = 2;
  } else {
    count = 1;
  }

  return { count, list: [] };
}
