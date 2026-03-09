import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, ArrowLeft } from 'lucide-react';
import { searchStops, Stop } from '../services/api';

interface StationSearchProps {
  label: string;
  value: string;
  onSelect: (stop: Stop) => void;
  placeholder?: string;
}

export default function StationSearch({ label, value, onSelect, placeholder }: StationSearchProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal query with external value when modal opens or value changes
  useEffect(() => {
    if (!isModalOpen) {
      setQuery(value);
    }
  }, [value, isModalOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Small delay to ensure the modal is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  const handleSearch = useCallback(async (val: string) => {
    setQuery(val);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (val.length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const stops = await searchStops(val, controller.signal);
          if (!controller.signal.aborted) {
            setResults(stops);
            setIsLoading(false);
          }
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error("Search error:", error);
            setIsLoading(false);
          }
        }
      }, 300);
    } else {
      setResults([]);
      setIsLoading(false);
    }
  }, []);

  const handleSelect = (stop: Stop) => {
    onSelect(stop);
    setIsModalOpen(false);
    // Don't clear results immediately to prevent flicker during close
  };

  return (
    <div className="w-full">
      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">
        {label}
      </label>
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-left transition-all hover:border-orange-300 shadow-sm group active:scale-[0.99]"
      >
        <MapPin className={`h-4 w-4 ${value ? 'text-orange-500' : 'text-zinc-400 group-hover:text-orange-400'}`} />
        <span className={`flex-1 truncate text-sm ${value ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
          {value || placeholder || "Search station..."}
        </span>
        <Search className="h-4 w-4 text-zinc-300" />
      </button>

      {/* Fullscreen Search Modal - Using fixed positioning to ensure it's above everything */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-zinc-50 flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="bg-white border-b border-zinc-200 p-4 pt-6 shadow-sm">
            <div className="max-w-md mx-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  className="block w-full pl-10 pr-10 py-3 bg-zinc-100 border-transparent rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all text-base"
                  placeholder="Where to?"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                  ) : query ? (
                    <button
                      type="button"
                      onClick={() => { setQuery(''); setResults([]); }}
                      className="p-1 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto bg-zinc-50 pb-20">
            <div className="max-w-md mx-auto p-4 space-y-6">
              {/* Results */}
              <div className="space-y-2">
                {query.length >= 2 && results.length === 0 && !isLoading ? (
                  <div className="text-center py-12 px-6">
                    <div className="bg-zinc-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="h-6 w-6 text-zinc-300" />
                    </div>
                    <p className="text-zinc-500 font-medium">No stations found for "{query}"</p>
                    <p className="text-zinc-400 text-xs mt-1">Try a different spelling or search term.</p>
                  </div>
                ) : (
                  results.map((stop) => (
                    <button
                      key={stop.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(stop);
                      }}
                      className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm hover:border-orange-200 transition-all text-left group active:bg-orange-50"
                    >
                      <div className="bg-zinc-50 p-2 rounded-xl group-hover:bg-orange-50 transition-colors">
                        <MapPin className="h-5 w-5 text-zinc-400 group-hover:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-zinc-800 text-sm truncate">{stop.name}</p>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{stop.type}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {isLoading && results.length > 0 && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 text-orange-500 animate-spin opacity-50" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
