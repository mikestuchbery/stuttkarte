import { useState, useRef, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Ticket, 
  Info, 
  Map as MapIcon,
  Train,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StationSearch from './components/StationSearch';
import LoadingScreen from './components/LoadingScreen';
import { Stop } from './services/api';
import { estimateZones } from './services/zoneEngine';
import { calculateBestFare, TravellerCounts, FareResult, JourneyType } from './services/fareEngine';

export type UIMode = 'expert' | 'beginner';

const POPULAR_DESTINATIONS = [
  { name: 'Mercedes-Benz Museum', station: 'Neckarpark', id: 'vvs:07003: : : ', zones: ['1'] },
  { name: 'Porsche Museum', station: 'Neuwirtshaus (Porscheplatz)', id: 'vvs:07001: : : ', zones: ['1'] },
  { name: 'Wilhelma Zoo', station: 'Wilhelma', id: 'vvs:07002: : : ', zones: ['1'] },
  { name: 'TV Tower', station: 'Ruhbank (Fernsehturm)', id: 'vvs:07004: : : ', zones: ['1'] },
  { name: 'City Center', station: 'Schlossplatz', id: 'vvs:07005: : : ', zones: ['1'] },
  { name: 'Ludwigsburg Palace', station: 'Ludwigsburg', id: 'vvs:07006: : : ', zones: ['2'] },
  { name: 'Esslingen Old Town', station: 'Esslingen (N)', id: 'vvs:07007: : : ', zones: ['2'] },
  { name: 'Public Library', station: 'Stadtbibliothek (Handwerkskammer)', id: 'vvs:07008: : : ', zones: ['1'] },
  { name: 'Killesberg Park', station: 'Killesberg', id: 'vvs:07009: : : ', zones: ['1'] },
  { name: 'SI-Centrum', station: 'Salzäcker', id: 'vvs:07010: : : ', zones: ['1'] },
  { name: 'Staatsgalerie', station: 'Staatsgalerie', id: 'vvs:07011: : : ', zones: ['1'] },
  { name: 'Grabkapelle', station: 'Rotenberg', id: 'vvs:07012: : : ', zones: ['1'] },
  { name: 'Solitude Palace', station: 'Solitude', id: 'vvs:07013: : : ', zones: ['1'] },
  { name: 'Mineral Baths', station: 'Mineralbäder', id: 'vvs:07014: : : ', zones: ['1'] },
  { name: 'Airport / Messe', station: 'Flughafen/Messe', id: 'vvs:07015: : : ', zones: ['2'] },
  { name: 'Hohenheim Gardens', station: 'Hohenheim', id: 'vvs:07016: : : ', zones: ['1'] },
  { name: 'Natural History Museum', station: 'Nordbahnhof', id: 'vvs:07017: : : ', zones: ['1'] },
];

export default function App() {
  const [origin, setOrigin] = useState<Stop>({ id: '', name: '', type: '' });
  const [destination, setDestination] = useState<Stop>({ id: '', name: '', type: '' });
  const [intermediates, setIntermediates] = useState<Stop[]>([]);
  const [counts, setCounts] = useState<TravellerCounts>({
    adults: 1,
    children: 0,
    under6: 0,
    students: 0,
    seniors: 0
  });
  const [dtHolders, setDtHolders] = useState(0);
  const [uiMode, setUiMode] = useState<UIMode>('beginner');
  const [journeyType, setJourneyType] = useState<JourneyType>('return');
  const [isAfter9AM, setIsAfter9AM] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    // Weekends (Saturday=6, Sunday=0) are always "after 9 AM" in terms of ticket validity
    if (day === 0 || day === 6) return true;
    return hour >= 9;
  });
  const [result, setResult] = useState<FareResult | null>(null);
  const [beginnerStep, setBeginnerStep] = useState(1);
  const [showOtherDestination, setShowOtherDestination] = useState(false);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4500); // Give enough time for the loading text animations
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      // Small timeout to ensure DOM is updated if it's a new element
      const timer = setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [result, scrollTrigger]);

  const isTouristMode = uiMode === 'beginner';

  const selectPopular = (dest: typeof POPULAR_DESTINATIONS[0]) => {
    setDestination({ id: dest.id, name: dest.station, type: 'stop', zones: dest.zones });
  };

  const addIntermediate = () => {
    setIntermediates([...intermediates, { id: '', name: '', type: '' }]);
  };

  const removeIntermediate = (index: number) => {
    setIntermediates(intermediates.filter((_, i) => i !== index));
  };

  const updateIntermediate = (index: number, stop: Stop) => {
    const newInter = [...intermediates];
    newInter[index] = stop;
    setIntermediates(newInter);
  };

  const updateCount = (key: keyof TravellerCounts, delta: number) => {
    setCounts(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta)
    }));
  };

  const handleCalculate = () => {
    if (!origin.name || !destination.name) return;

    const allStops = [origin, ...intermediates, destination].filter(s => s.name);
    const zoneInfo = estimateZones(allStops);
    
    // Detect if it's potentially a short trip (Kurzstrecke)
    // In VVS, Kurzstrecke is generally up to 3 stops on S-Bahn/U-Bahn or 1 stop on Bus
    // Since we don't have the full route, we'll add a manual toggle in Expert mode
    // but for Beginner mode we'll stick to zone-based for safety.
    
    const fare = calculateBestFare(counts, zoneInfo, dtHolders, isTouristMode, journeyType, isAfter9AM);
    setResult(fare);
    setScrollTrigger(prev => prev + 1);
    if (uiMode === 'beginner') setBeginnerStep(4);
  };

  const handleBuyNow = () => {
    // As requested, just take to the main English ticket site
    window.open('https://www.vvs.de/en/tickets-and-subscriptions', '_blank');
  };

  const handleOpenMap = () => {
    const start = encodeURIComponent(origin.name);
    const end = encodeURIComponent(destination.name);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${end}&travelmode=transit`;
    window.open(url, '_blank');
  };

  const resetBeginner = () => {
    setBeginnerStep(1);
    setResult(null);
    setDtHolders(0);
  };

  useEffect(() => {
    const totalPeople = counts.adults + counts.children + counts.students + counts.seniors;
    if (dtHolders > totalPeople) {
      setDtHolders(totalPeople);
    }
  }, [counts, dtHolders]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-12">
      <AnimatePresence>
        {isLoading && <LoadingScreen />}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-orange-500 p-2 rounded-xl">
                <Train className="text-white h-5 w-5" />
              </div>
              <h1 className="font-black text-xl tracking-tight">Stutt<span className="text-orange-500">karte</span> <span className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-500 align-top ml-1">BETA</span></h1>
            </div>
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full">
              {(['beginner', 'expert'] as UIMode[]).map((mode) => (
                <button 
                  key={mode}
                  onClick={() => {
                    setUiMode(mode);
                    if (mode === 'beginner') resetBeginner();
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${uiMode === mode ? 'bg-white shadow-sm text-orange-600' : 'text-zinc-400'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-6">
        {uiMode === 'beginner' ? (
          <div className="space-y-8">
            {/* Beginner Wizard */}
            <div className="flex justify-between items-center px-2">
              {[1, 2, 3, 4].map((s) => (
                <div 
                  key={s} 
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    beginnerStep === s ? 'bg-orange-500 text-white scale-110' : 
                    beginnerStep > s ? 'bg-green-500 text-white' : 'bg-zinc-200 text-zinc-400'
                  }`}
                >
                  {beginnerStep > s ? '✓' : s}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {beginnerStep === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-zinc-900">I'm going to...</h2>
                    <p className="text-zinc-500 text-sm">Select a museum or search for a station.</p>
                  </div>
                  <div className="space-y-4 bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
                    <StationSearch label="Start" value={origin.name} onSelect={setOrigin} />
                    
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Where are you going?</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {POPULAR_DESTINATIONS.map((dest) => (
                          <button
                            key={dest.name}
                            type="button"
                            onClick={() => {
                              selectPopular(dest);
                              setShowOtherDestination(false);
                            }}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                              destination.name === dest.station 
                                ? 'bg-orange-500 text-white border-orange-500' 
                                : 'bg-zinc-50 text-zinc-500 border-zinc-100 hover:border-zinc-200'
                            }`}
                          >
                            {dest.name}
                          </button>
                        ))}
                      </div>

                      {!showOtherDestination && !destination.name && (
                        <button 
                          type="button"
                          onClick={() => setShowOtherDestination(true)}
                          className="text-orange-600 text-[10px] font-bold uppercase tracking-wider hover:underline"
                        >
                          + Somewhere else?
                        </button>
                      )}

                      {(showOtherDestination || destination.name) && (
                        <div className="pt-2 border-t border-zinc-50 mt-2">
                          <StationSearch label="Destination" value={destination.name} onSelect={setDestination} />
                          <button 
                            type="button"
                            onClick={() => {
                              setDestination({ id: '', name: '', type: '' });
                              setShowOtherDestination(false);
                            }}
                            className="text-zinc-400 text-[10px] mt-2 hover:text-zinc-600"
                          >
                            Clear destination
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    disabled={!origin.name || !destination.name}
                    onClick={() => setBeginnerStep(2)}
                    className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </motion.div>
              )}

              {beginnerStep === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-zinc-900">Who is coming?</h2>
                    <p className="text-zinc-500 text-sm">Select the number of people.</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Adults</span>
                      <div className="flex items-center gap-4">
                        <button onClick={() => updateCount('adults', -1)} className="w-8 h-8 rounded-full border border-zinc-200">-</button>
                        <span className="font-bold">{counts.adults}</span>
                        <button onClick={() => updateCount('adults', 1)} className="w-8 h-8 rounded-full border border-zinc-200">+</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Children (6-14)</span>
                      <div className="flex items-center gap-4">
                        <button onClick={() => updateCount('children', -1)} className="w-8 h-8 rounded-full border border-zinc-200">-</button>
                        <span className="font-bold">{counts.children}</span>
                        <button onClick={() => updateCount('children', 1)} className="w-8 h-8 rounded-full border border-zinc-200">+</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBeginnerStep(1)} className="flex-1 bg-zinc-200 text-zinc-700 py-4 rounded-2xl font-bold">Back</button>
                    <button onClick={() => setBeginnerStep(3)} className="flex-[2] bg-orange-500 text-white py-4 rounded-2xl font-bold">Next</button>
                  </div>
                </motion.div>
              )}

              {beginnerStep === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-zinc-900">One last thing...</h2>
                    <p className="text-zinc-500 text-sm">How many people have a Deutschlandticket?</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">DT Holders</span>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setDtHolders(Math.max(0, dtHolders - 1))} 
                          className="w-8 h-8 rounded-full border border-zinc-200"
                        >
                          -
                        </button>
                        <span className="font-bold">{dtHolders}</span>
                        <button 
                          onClick={() => setDtHolders(Math.min(counts.adults + counts.children + counts.students + counts.seniors, dtHolders + 1))} 
                          className="w-8 h-8 rounded-full border border-zinc-200"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-zinc-50">
                      <p className="text-xs font-bold text-zinc-400 uppercase mb-3">Journey Type</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setJourneyType('one-way')} className={`py-3 rounded-xl text-xs font-bold border ${journeyType === 'one-way' ? 'bg-orange-500 text-white border-orange-500' : 'bg-zinc-50 text-zinc-500'}`}>One-way</button>
                        <button onClick={() => setJourneyType('return')} className={`py-3 rounded-xl text-xs font-bold border ${journeyType === 'return' ? 'bg-orange-500 text-white border-orange-500' : 'bg-zinc-50 text-zinc-500'}`}>Return</button>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-zinc-50">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <div>
                          <p className="font-bold text-zinc-800">Traveling after 9 AM?</p>
                          <p className="text-xs text-zinc-400">Cheaper day tickets available</p>
                        </div>
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={isAfter9AM}
                            onChange={(e) => setIsAfter9AM(e.target.checked)}
                          />
                          <div className={`w-12 h-6 rounded-full transition-colors ${isAfter9AM ? 'bg-orange-500' : 'bg-zinc-200'}`}></div>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isAfter9AM ? 'translate-x-6' : ''}`}></div>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBeginnerStep(2)} className="flex-1 bg-zinc-200 text-zinc-700 py-4 rounded-2xl font-bold">Back</button>
                    <button onClick={handleCalculate} className="flex-[2] bg-orange-500 text-white py-4 rounded-2xl font-bold">Find Ticket</button>
                  </div>
                </motion.div>
              )}

              {beginnerStep === 4 && result && (
                <motion.div 
                  ref={resultRef}
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black text-zinc-900">Your Best Ticket!</h2>
                    <p className="text-zinc-500 text-sm">Here is what you should buy.</p>
                  </div>
                  
                  <div className="bg-white rounded-3xl p-8 shadow-2xl border-2 border-orange-500 text-center space-y-6">
                    <div>
                      <p className="text-orange-500 font-black text-4xl mb-2">€{result.price.toFixed(2)}</p>
                      <h3 className="text-xl font-bold text-zinc-800">{result.ticket}</h3>
                    </div>
                    <p className="text-zinc-600 text-sm leading-relaxed px-4">
                      {result.explanation}
                    </p>

                    {result.breakdown && result.breakdown.length > 0 && (
                      <div className="bg-zinc-50 rounded-2xl p-4 space-y-3">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-left">Exactly what to buy:</p>
                        <div className="space-y-2">
                          {result.breakdown.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm font-bold text-zinc-800">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-orange-500" />
                                <span>{item}</span>
                              </div>
                              <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-[10px]">REQUIRED</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pro Tips Section for Beginner Mode */}
                    <div className="bg-zinc-50 rounded-2xl p-4 space-y-3 text-left">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pro Tips:</p>
                      <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-zinc-600 leading-relaxed">
                            <span className="font-bold text-zinc-800">Bikes & Dogs:</span> Bikes are free on S/U-Bahn except 6-9 AM (Mon-Fri). Large dogs need a child ticket.
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-zinc-600 leading-relaxed">
                            <span className="font-bold text-zinc-800">Weekends & Holidays:</span> The 9 AM discount applies all day on weekends and public holidays!
                          </p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-zinc-600 leading-relaxed">
                            <span className="font-bold text-zinc-800">First Class:</span> These prices are for 2nd class. S-Bahn 1st class requires a supplement.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-zinc-100 grid grid-cols-1 gap-3">
                      <button 
                        onClick={handleBuyNow} 
                        className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-100 text-lg"
                      >
                        <Ticket className="h-5 w-5" /> Buy Now
                      </button>
                      <button 
                        onClick={handleOpenMap} 
                        className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-zinc-100 text-lg"
                      >
                        <MapIcon className="h-5 w-5" /> Open Map
                      </button>
                      <button onClick={resetBeginner} className="w-full text-zinc-400 text-sm font-bold py-2 mt-2">Start Over</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Route Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapIcon className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Your Route</h2>
              </div>
              
              <div className="space-y-3">
                <StationSearch 
                  label="From" 
                  value={origin.name} 
                  onSelect={setOrigin} 
                  placeholder="Start station"
                />

                <AnimatePresence>
                  {intermediates.map((stop, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative"
                    >
                      <StationSearch 
                        label={`Via ${index + 1}`} 
                        value={stop.name} 
                        onSelect={(s) => updateIntermediate(index, s)} 
                        placeholder="Intermediate stop"
                      />
                      <button 
                        onClick={() => removeIntermediate(index)}
                        className="absolute top-8 right-12 p-2 text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <StationSearch 
                  label="To" 
                  value={destination.name} 
                  onSelect={setDestination} 
                  placeholder="End station"
                />

                <button 
                  onClick={addIntermediate}
                  className="flex items-center gap-2 text-orange-600 text-sm font-semibold py-2 px-1 hover:text-orange-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add intermediate stop
                </button>
              </div>
            </section>

            {/* Journey Options Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Journey Details</h2>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Journey Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'one-way', label: 'One-way' },
                      { id: 'return', label: 'Return' },
                      { id: 'multiple', label: 'All Day' },
                      { id: 'short-trip', label: 'Short Trip' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setJourneyType(type.id as JourneyType)}
                        className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                          journeyType === type.id 
                            ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-100' 
                            : 'bg-zinc-50 text-zinc-500 border-zinc-100 hover:border-zinc-200'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-100 p-2 rounded-xl">
                        <Clock className="h-4 w-4 text-zinc-500" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800 text-sm">Travelling after 9 AM?</p>
                        <p className="text-[10px] text-zinc-400">Cheaper tickets available Mon-Fri</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isAfter9AM}
                        onChange={(e) => setIsAfter9AM(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Travellers Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Travellers</h2>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Adults', key: 'adults' as const, sub: '15+ years' },
                    { label: 'Children', key: 'children' as const, sub: '6-14 years' },
                    { label: 'Under 6', key: 'under6' as const, sub: 'Travel free' },
                    { label: 'Students', key: 'students' as const, sub: 'With ID' },
                    { label: 'Seniors', key: 'seniors' as const, sub: '65+ years' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-zinc-800">{item.label}</p>
                        <p className="text-xs text-zinc-400">{item.sub}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => updateCount(item.key, -1)}
                          className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-bold text-lg">{counts[item.key]}</span>
                        <button 
                          onClick={() => updateCount(item.key, 1)}
                          className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-zinc-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-800">Deutschlandticket</p>
                      <p className="text-xs text-zinc-400">Holders in group</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setDtHolders(Math.max(0, dtHolders - 1))}
                        className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all"
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-bold text-lg">{dtHolders}</span>
                      <button 
                        onClick={() => setDtHolders(Math.min(counts.adults + counts.children + counts.students + counts.seniors, dtHolders + 1))}
                        className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-50">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <p className="font-bold text-zinc-800">Traveling after 9 AM?</p>
                      <p className="text-xs text-zinc-400">Enables 9 AM Day Ticket</p>
                    </div>
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={isAfter9AM}
                        onChange={(e) => setIsAfter9AM(e.target.checked)}
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${isAfter9AM ? 'bg-orange-500' : 'bg-zinc-200'}`}></div>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isAfter9AM ? 'translate-x-6' : ''}`}></div>
                    </div>
                  </label>
                </div>
              </div>
            </section>

            {/* Action Button */}
            <button 
              onClick={handleCalculate}
              disabled={!origin.name || !destination.name}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Train className="h-5 w-5" />
              Which ticket?
            </button>

            {/* Result Section */}
            <AnimatePresence>
              {result && (
                <motion.div 
                  ref={resultRef}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Recommendation</h2>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-xl border border-orange-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Ticket className="h-24 w-24" />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Best Value</p>
                          <h3 className="text-2xl font-black text-zinc-900">{result.ticket}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-zinc-900">€{result.price.toFixed(2)}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase">
                            {result.zones} {result.zones === 1 ? 'Zone' : 'Zones'}
                            {result.zoneList && result.zoneList.length > 0 && ` (${result.zoneList.join(', ')})`}
                          </p>
                        </div>
                      </div>

                      <div className="bg-zinc-50 rounded-2xl p-4 flex gap-3 items-start mb-4">
                        <Info className="h-5 w-5 text-zinc-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-zinc-600 leading-relaxed">
                          {result.explanation}
                        </p>
                      </div>

                      {result.breakdown && result.breakdown.length > 0 && (
                        <div className="mb-6 px-1">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Exactly what to buy:</p>
                          <div className="space-y-2">
                            {result.breakdown.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs font-bold text-zinc-700 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                  <span>{item}</span>
                                </div>
                                <span className="text-[10px] text-orange-600 font-black">REQUIRED</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pro Tips Section */}
                      <div className="mb-6 px-1">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Pro Tips & Blind Spots:</p>
                        <div className="space-y-3">
                          <div className="flex gap-3 items-start">
                            <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-zinc-800">Bicycles & Dogs</p>
                              <p className="text-[10px] text-zinc-500 leading-relaxed">Bikes are free on S/U-Bahn except 6-9 AM (Mon-Fri). Large dogs need a child ticket.</p>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-zinc-800">Weekends & Holidays</p>
                              <p className="text-[10px] text-zinc-500 leading-relaxed">The 9 AM discount applies all day on weekends and public holidays.</p>
                            </div>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-zinc-800">First Class</p>
                              <p className="text-[10px] text-zinc-500 leading-relaxed">These prices are for 2nd class. S-Bahn 1st class requires a supplement.</p>
                            </div>
                          </div>
                          {journeyType === 'short-trip' && (
                            <div className="flex gap-3 items-start">
                              <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                                <AlertCircle className="h-3 w-3 text-orange-500" />
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-zinc-800">Short Trip Rules</p>
                                <p className="text-[10px] text-zinc-500 leading-relaxed">Valid for up to 3 stops on S-Bahn/U-Bahn or 1 stop on Bus. No returns or transfers allowed.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button 
                          onClick={handleBuyNow}
                          className="flex items-center justify-center gap-3 w-full p-4 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 font-black text-lg group"
                        >
                          <Ticket className="h-6 w-6" />
                          <span>Buy Now</span>
                        </button>

                        <button 
                          onClick={handleOpenMap}
                          className="flex items-center justify-center gap-3 w-full p-4 bg-zinc-900 text-white rounded-2xl hover:bg-black transition-all shadow-lg shadow-zinc-100 font-black text-lg group"
                        >
                          <MapIcon className="h-6 w-6" />
                          <span>Map</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex gap-2 items-start px-2 py-4 opacity-50">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-tight">
            This app provides ticket recommendations based on estimated zones. 
            Prices are approximate. Always check official VVS channels for the most accurate information. 
            No live departure times provided.
          </p>
        </div>
      </main>
    </div>
  );
}
