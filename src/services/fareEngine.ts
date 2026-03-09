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

// VVS Price Table (Effective Feb 1, 2026)
const PRICES = {
  single: {
    adult: [0, 3.70, 4.50, 6.20, 7.90, 9.60], // index = zones
    child: [0, 1.80, 2.20, 3.00, 3.80, 4.60],
  },
  short: {
    adult: 2.00,
    child: 1.10,
  },
  day: {
    single: [0, 7.40, 9.00, 12.40, 15.80, 19.20],
    child: 3.70, // Child Day Ticket is valid for the entire network (Netz)
    group: [0, 16.10, 16.10, 22.20, 22.20, 22.20],
  },
  day9am: {
    single: [0, 6.70, 8.10, 11.20, 14.20, 17.30],
    group: [0, 13.70, 13.70, 19.40, 19.40, 19.40],
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
  
  // Ringfence check: If any zone is unknown, we are outside the VVS network
  if (zoneList.includes('?')) {
    return {
      ticket: "Outside VVS Network",
      price: 0,
      zones: 0,
      zoneList: zoneList,
      explanation: isTouristMode
        ? "One or more of your stops are outside the VVS network area. We can only calculate fares within the VVS integrated tariff area."
        : "Journey involves stops outside the VVS integrated tariff area. Please ensure all stops are within the VVS network.",
      type: 'outside',
      breakdown: ["Outside VVS Network Area"]
    };
  }
  
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
  // Note: Child Day Ticket is always the same price and valid all day
  const dayTable = isAfter9AM ? PRICES.day9am : PRICES.day;
  
  // Find optimal combination of Group and Individual Day Tickets
  let optimalDayPrice = Infinity;
  let optimalDayBreakdown: string[] = [];
  let optimalDayName = isAfter9AM ? '9-Uhr-TagesTicket' : 'Day Ticket';

  if (totalChargeable > 0) {
    const groupBasePrice = dayTable.group[zones] || dayTable.group[5];
    const adultDayBasePrice = dayTable.single[zones] || dayTable.single[5];
    const childDayBasePrice = PRICES.day.child; // Child day ticket is always Netz
    
    // We try using 0 to N group tickets and fill the rest with individual tickets
    // A group ticket covers up to 5 people (adults or children)
    const maxGroups = Math.ceil(totalChargeable / 1); // Safety bound
    for (let numGroups = 0; numGroups <= Math.ceil(totalChargeable / 5) + 1; numGroups++) {
      const remainingAdults = Math.max(0, chargeableAdults - (numGroups * 5));
      const remainingChildren = Math.max(0, chargeableChildren - Math.max(0, (numGroups * 5) - chargeableAdults));
      
      const currentPrice = (numGroups * groupBasePrice) + 
                          (remainingAdults * adultDayBasePrice) + 
                          (remainingChildren * childDayBasePrice);
      
      if (currentPrice < optimalDayPrice) {
        optimalDayPrice = currentPrice;
        optimalDayBreakdown = [];
        if (numGroups > 0) optimalDayBreakdown.push(`${numGroups}x ${isAfter9AM ? '9-Uhr-GruppenTagesTicket' : 'Group Day Ticket'}`);
        if (remainingAdults > 0) optimalDayBreakdown.push(`${remainingAdults}x ${isAfter9AM ? '9-Uhr-TagesTicket (Adult)' : 'Day Ticket (Adult)'}`);
        if (remainingChildren > 0) optimalDayBreakdown.push(`${remainingChildren}x Child Day Ticket`);
        
        const hasMultipleTypes = (numGroups > 0 ? 1 : 0) + (remainingAdults > 0 ? 1 : 0) + (remainingChildren > 0 ? 1 : 0) > 1;
        
        if (hasMultipleTypes) {
          optimalDayName = 'Day Ticket Combo';
        } else if (numGroups > 0) {
          optimalDayName = isAfter9AM ? '9-Uhr-GruppenTagesTicket' : 'Group Day Ticket';
        } else if (remainingAdults > 0) {
          optimalDayName = isAfter9AM ? '9-Uhr-TagesTicket' : 'Day Ticket';
        } else {
          optimalDayName = 'Child Day Ticket';
        }
      }
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
    
    return {
      ticket: "No Ticket Needed",
      price: 0,
      zones: zones,
      explanation: "Please select at least one passenger who needs a ticket.",
      type: 'none',
      breakdown: []
    };
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
