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
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search fighters..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-4"
          onFocus={() => setShowSuggestions(true)}
        />
      </motion.div>
      <AnimatePresence mode="wait">
        {showSuggestions && (searchTerm.trim() || isLoading || error) && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-full w-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
          >
            <Command className="rounded-md" shouldFilter={false}>
              {error && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-2 text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}
              {isLoading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-2"
                >
                  <div className="flex items-center justify-center py-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                    />
                  </div>
                </motion.div>
              ) : validFighters.length === 0 ? (
                <CommandEmpty>No fighters found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {validFighters.map((fighter, index) => (
                    <motion.div
                      key={`${fighter}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <CommandItem
                        value={fighter}
                        onSelect={handleFighterSelect}
                        className="cursor-pointer transition-colors"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 transition-opacity",
                            searchTerm === fighter ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {getFighterDisplayElement(fighter)}
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