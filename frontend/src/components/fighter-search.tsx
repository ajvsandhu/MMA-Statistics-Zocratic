"use client"

import * as React from "react"
import { Check, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ENDPOINTS } from "@/lib/api-config"
import { motion, AnimatePresence } from "framer-motion"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

interface FighterSearchProps {
  onSelectFighter: (fighter: string) => void
  clearSearch?: boolean
}

export function FighterSearch({ onSelectFighter, clearSearch }: FighterSearchProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [fighters, setFighters] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Handle click outside to close suggestions
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Clear search when clearSearch prop changes
  React.useEffect(() => {
    if (clearSearch) {
      setSearchTerm("")
      setFighters([])
      setShowSuggestions(false)
    }
  }, [clearSearch])

  // Fetch fighters when search term changes
  React.useEffect(() => {
    const controller = new AbortController();
    
    if (!searchTerm.trim()) {
      setFighters([]);
      setShowSuggestions(false);
      return;
    }

    const fetchFighters = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(ENDPOINTS.FIGHTERS_SEARCH(searchTerm.trim()), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch fighters');
        }
        
        const data = await response.json();
        
        // Add extra safety checks for the fighters data
        let fightersList: string[] = [];
        if (data && data.fighters && Array.isArray(data.fighters)) {
          // Filter out any null or undefined values and ensure all items are strings
          fightersList = data.fighters
            .filter((fighter: any) => fighter != null)
            .map((fighter: any) => String(fighter));
        }
        
        // Limit to 5 suggestions
        setFighters(fightersList.slice(0, 5));
        setShowSuggestions(true);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch fighters');
        setFighters([]);
      } finally {
        setIsLoading(false);
      }
    }

    const debounceTimer = setTimeout(fetchFighters, 300);
    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [searchTerm]);

  const formatFighterDisplay = (fighter: string) => {
    if (!fighter) return '';
    if (!fighter.includes('(')) return fighter;
    return fighter;
  }
  
  const getFighterDisplayElement = (fighter: string) => {
    if (!fighter) return <span>No name</span>;
    
    if (!fighter.includes('(')) return <span>{fighter}</span>;

    try {
      const [baseName, ...rest] = fighter.split('(');
      const info = '(' + rest.join('(');
      return (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col"
        >
          <span className="font-medium">{baseName.trim()}</span>
          <span className="text-sm text-muted-foreground">{info}</span>
        </motion.div>
      );
    } catch (err) {
      console.error('Error creating fighter display element:', err);
      return <span>{fighter}</span>;
    }
  }

  const handleFighterSelect = (currentValue: string) => {
    if (!currentValue) {
      console.error('Invalid fighter value:', currentValue);
      return;
    }
    
    try {
      let cleanValue = String(currentValue).trim();
      onSelectFighter(cleanValue);
      setShowSuggestions(false);
      setSearchTerm(""); 
    } catch (err) {
      console.error('Error processing fighter selection:', err);
    }
  };
  
  const validFighters = fighters.filter(fighter => 
    fighter !== undefined && fighter !== null && typeof fighter === 'string'
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <motion.div 
        initial={false}
        animate={{ scale: isLoading ? 0.99 : 1 }}
        transition={{ duration: 0.15 }}
        className="relative"
        style={{ willChange: 'transform' }}
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
        <Input
          placeholder="Search fighters..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 h-12 bg-background/60 border-0 ring-1 ring-white/10 focus:ring-primary/20 focus:bg-background/80 transition-all duration-300 rounded-lg placeholder:text-muted-foreground/50"
          onFocus={() => setShowSuggestions(true)}
        />
      </motion.div>
      <AnimatePresence mode="wait">
        {showSuggestions && (searchTerm.trim() || isLoading || error) && (
          <motion.div 
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-[calc(100%+0.75rem)] w-full z-50 rounded-lg border bg-background/95 backdrop-blur-sm text-foreground shadow-lg overflow-hidden"
            style={{ willChange: 'transform, opacity' }}
          >
            <Command className="rounded-lg border-0" shouldFilter={false}>
              {error && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 text-sm text-destructive/90 text-center"
                >
                  {error}
                </motion.p>
              )}
              {isLoading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4"
                >
                  <div className="flex items-center justify-center py-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full"
                    />
                  </div>
                </motion.div>
              ) : !validFighters.length && searchTerm.trim() ? (
                <CommandEmpty className="py-8 text-sm text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-muted-foreground/40 mb-2">
                        <Search className="w-6 h-6" />
                      </div>
                    </motion.div>
                    No fighters found
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup className="py-2 px-1">
                  {validFighters.map((fighter, index) => (
                    <motion.div
                      key={`${fighter}-${index}`}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: index * 0.03 }}
                      style={{ willChange: 'transform, opacity' }}
                    >
                      <CommandItem
                        value={fighter}
                        onSelect={handleFighterSelect}
                        className="cursor-pointer transition-all duration-200 py-3 px-3 mx-1 my-0.5 rounded-md data-[selected=true]:bg-accent/50 hover:bg-accent/40 group"
                      >
                        <div className="relative mr-3">
                          <Check
                            className={cn(
                              "w-4 h-4 text-primary transition-all duration-300",
                              searchTerm === fighter ? "opacity-100 scale-100" : "opacity-0 scale-90"
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          {getFighterDisplayElement(fighter)}
                        </div>
                      </CommandItem>
                    </motion.div>
                  ))}
                </CommandGroup>
              )}
            </Command>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 