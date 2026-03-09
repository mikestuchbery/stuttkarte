/**
 * Fare Engine for VVS Stuttgart.
 * Compares different ticket options and returns the cheapest.
 */

import { ZoneInfo } from './zoneEngine';

export interface TravellerCounts {
  adults: number;
  children: number; // 6-14
  under6: number;
  students: number;
  seniors: number;
}

export type JourneyType = 'one-way' | 'return' | 'multiple' | 'short-trip';

export interface FareResult {
  ticket: string;
  price: number;
  zones: number;
  zoneList?: string[];
  explanation: string;
  type: string;
  breakdown: string[];
}

// VVS Price Table (Effective Jan 1, 2026)
const PRICES = {
  single: {
    adult: [0, 3.50, 4.30, 5.90, 7.50, 9.10], // index = zones
    child: [0, 1.70, 2.10, 2.90, 3.60, 4.40],
  },
  short: {
    adult: 1.90,
    child: 1.00,
  },
  day: {
    single: [0, 7.00, 8.60, 11.80, 15.00, 18.20],
    group: [0, 15.20, 15.20, 21.00, 21.00, 21.00],
  },
  day9am: {
    single: [0, 6.30, 7.70, 10.60, 13.50, 16.40],
    group: [0, 13.00, 13.00, 18.40, 18.40, 18.40],
  }
};

export function calculateBestFare(
  counts: TravellerCounts,
  zoneInfo: ZoneInfo,
  dtHolders: number,
  isTouristMode: boolean,
  journeyType: JourneyType = 'return',
  isAfter9AM: boolean = false
): FareResult {
  const zones = zoneInfo.count;
  const zoneList = zoneInfo.list;
  
  // Calculate total people who normally need a ticket
  const totalAdults = counts.adults + counts.students + counts.seniors;
  const totalChildren = counts.children;
  
  // Subtract DT holders from the counts, prioritizing adults as they are more expensive
  let remainingDT = dtHolders;
  const chargeableAdults = Math.max(0, totalAdults - remainingDT);
  remainingDT = Math.max(0, remainingDT - totalAdults);
  const chargeableChildren = Math.max(0, totalChildren - remainingDT);
  
  const totalChargeable = chargeableAdults + chargeableChildren;

  // 0. Short Trip (Kurzstrecke)
  let shortTripPrice = Infinity;
  if (journeyType === 'short-trip') {
    shortTripPrice = (PRICES.short.adult * chargeableAdults) + (PRICES.short.child * chargeableChildren);
  }

  // 1. Single Tickets
  const singleAdultPrice = (PRICES.single.adult[zones] || PRICES.single.adult[5]) * chargeableAdults;
  const singleChildPrice = (PRICES.single.child[zones] || PRICES.single.child[5]) * chargeableChildren;
  const totalSingleOneWay = singleAdultPrice + singleChildPrice;
  
  let totalSinglePrice = totalSingleOneWay;
  if (journeyType === 'return') totalSinglePrice = totalSingleOneWay * 2;
  if (journeyType === 'multiple') totalSinglePrice = totalSingleOneWay * 3; // Assume at least 3 for "multiple"

  // 2. Day Tickets (Standard vs 9 AM)
  const dayTable = isAfter9AM ? PRICES.day9am : PRICES.day;
  
  // Find optimal combination of Group and Individual Day Tickets
  let optimalDayPrice = Infinity;
  let optimalDayBreakdown: string[] = [];
  let optimalDayName = isAfter9AM ? '9-Uhr-TagesTicket' : 'Day Ticket';

  if (totalChargeable > 0) {
    const groupBasePrice = dayTable.group[zones] || dayTable.group[5];
    const individualBasePrice = dayTable.single[zones] || dayTable.single[5];
    
    // We try using 0 to N group tickets and fill the rest with individual tickets
    for (let numGroups = 0; numGroups <= Math.ceil(totalChargeable / 1); numGroups++) {
      const coveredByGroups = numGroups * 5;
      const remaining = Math.max(0, totalChargeable - coveredByGroups);
      
      const currentPrice = (numGroups * groupBasePrice) + (remaining * individualBasePrice);
      
      if (currentPrice < optimalDayPrice) {
        optimalDayPrice = currentPrice;
        optimalDayBreakdown = [];
        if (numGroups > 0) optimalDayBreakdown.push(`${numGroups}x ${isAfter9AM ? '9-Uhr-GruppenTagesTicket' : 'Group Day Ticket'}`);
        if (remaining > 0) optimalDayBreakdown.push(`${remaining}x ${isAfter9AM ? '9-Uhr-TagesTicket (Single)' : 'Day Ticket (Single)'}`);
        
        if (numGroups > 0 && remaining > 0) {
          optimalDayName = isAfter9AM ? '9-Uhr-Ticket Combo' : 'Day Ticket Combo';
        } else if (numGroups > 0) {
          optimalDayName = isAfter9AM ? '9-Uhr-GruppenTagesTicket' : 'Group Day Ticket';
        } else {
          optimalDayName = isAfter9AM ? '9-Uhr-TagesTicket (Single)' : 'Day Ticket (Single)';
        }
      }
      if (coveredByGroups >= totalChargeable) break;
    }
  }

  // Comparison
  const options = [
    { name: `Single Tickets (${journeyType})`, price: totalSinglePrice, type: 'single', breakdown: [] as string[] },
    { name: optimalDayName, price: optimalDayPrice, type: 'day-optimal', breakdown: optimalDayBreakdown }
  ];

  if (journeyType === 'short-trip') {
    options.push({ name: 'Short Trip (Kurzstrecke)', price: shortTripPrice, type: 'short', breakdown: [] as string[] });
  }

  // Breakdown calculation
  let remainingDTForBreakdown = dtHolders;
  const adultsToBuy = Math.max(0, counts.adults - remainingDTForBreakdown);
  remainingDTForBreakdown = Math.max(0, remainingDTForBreakdown - counts.adults);
  const studentsToBuy = Math.max(0, counts.students - remainingDTForBreakdown);
  remainingDTForBreakdown = Math.max(0, remainingDTForBreakdown - counts.students);
  const seniorsToBuy = Math.max(0, counts.seniors - remainingDTForBreakdown);
  remainingDTForBreakdown = Math.max(0, remainingDTForBreakdown - counts.seniors);
  const childrenToBuy = Math.max(0, counts.children - remainingDTForBreakdown);

  // Populate single ticket breakdown
  const multiplier = journeyType === 'one-way' ? 1 : (journeyType === 'return' ? 2 : 3);
  if (adultsToBuy > 0) options[0].breakdown.push(`${adultsToBuy * multiplier}x Single Ticket (Adult)`);
  if (studentsToBuy > 0) options[0].breakdown.push(`${studentsToBuy * multiplier}x Single Ticket (Student)`);
  if (seniorsToBuy > 0) options[0].breakdown.push(`${seniorsToBuy * multiplier}x Single Ticket (Senior)`);
  if (childrenToBuy > 0) options[0].breakdown.push(`${childrenToBuy * multiplier}x Single Ticket (Child)`);

  if (journeyType === 'short-trip') {
    const shortOption = options.find(o => o.type === 'short');
    if (shortOption) {
      if (adultsToBuy > 0) shortOption.breakdown.push(`${adultsToBuy}x Short Trip (Adult)`);
      if (studentsToBuy > 0) shortOption.breakdown.push(`${studentsToBuy}x Short Trip (Student)`);
      if (seniorsToBuy > 0) shortOption.breakdown.push(`${seniorsToBuy}x Short Trip (Senior)`);
      if (childrenToBuy > 0) shortOption.breakdown.push(`${childrenToBuy}x Short Trip (Child)`);
    }
  }

  // Filter out zero or infinity
  const validOptions = options.filter(o => o.price > 0 && o.price !== Infinity);
  
  if (validOptions.length === 0) {
    if (counts.under6 > 0 && totalChargeable === 0) {
      return {
        ticket: "Free Travel",
        price: 0,
        zones: zones,
        explanation: isTouristMode 
          ? "Children under 6 travel for free!" 
          : `All ${counts.under6} travellers are under 6 years old and travel free of charge.`,
        type: 'free',
        breakdown: [`${counts.under6}x Child under 6 (Free)`]
      };
    }
    if (dtHolders > 0 && totalChargeable === 0) {
      return {
        ticket: "Deutschlandticket Coverage",
        price: 0,
        zones: zones,
        explanation: isTouristMode
          ? "Your Deutschlandticket covers this journey."
          : `${dtHolders} ${dtHolders === 1 ? 'person has' : 'people have'} a Deutschlandticket, which covers the journey.`,
        type: 'deutschlandticket',
        breakdown: [`${dtHolders}x Deutschlandticket (Already paid)`]
      };
    }
  }

  const best = validOptions.reduce((prev, curr) => prev.price < curr.price ? prev : curr);

  let explanation = "";
  const journeyLabel = journeyType === 'one-way' ? 'one-way journey' : journeyType === 'return' ? 'return journey' : 'multiple journeys';
  
  if (isTouristMode) {
    explanation = `The ${best.name} is the best value for your ${journeyLabel} across ${zones} ${zones === 1 ? 'zone' : 'zones'}.`;
    if (isAfter9AM && best.type.includes('day')) explanation += " Since you are travelling after 9 AM, you save even more with the 9-Uhr ticket!";
  } else {
    explanation = `For ${totalChargeable} travellers doing a ${journeyLabel} across ${zones} zones, the ${best.name} costs €${best.price.toFixed(2)}.`;
    if (isAfter9AM && best.type.includes('day')) explanation += " (9 AM discount applied)";
    if (dtHolders > 0) {
      explanation += ` (${dtHolders} ${dtHolders === 1 ? 'person' : 'people'} with Deutschlandticket excluded from costs)`;
    }
  }

  return {
    ticket: best.name,
    price: best.price,
    zones: zones,
    zoneList: zoneList,
    explanation: explanation,
    type: best.type,
    breakdown: best.breakdown
  };
}
