"use client"

import * as React from "react"
import { Check, Search, History, X, Filter } from "lucide-react"
import { cn, useIsMobile, createFighterSlug } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ENDPOINTS } from "@/lib/api-config"
import { motion, AnimatePresence } from "framer-motion"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SimpleSelect } from "@/components/ui/simple-select"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from 'react'
import { getAnimationVariants, fadeAnimation } from '@/lib/animations'

interface Fighter {
  id: string;
  name: string;
}

const SEARCH_HISTORY_KEY = "fighter-search-history"
const SEARCH_HISTORY_EVENT = 'fighter-search-history-updated'
const MAX_HISTORY_ITEMS = 5
const COMPARE_PAGE_HISTORY_KEY_1 = "fighter-search-history-compare-1"
const COMPARE_PAGE_HISTORY_KEY_2 = "fighter-search-history-compare-2"

const WEIGHT_CLASSES = [
  "265 lbs.",
  "205 lbs.",
  "185 lbs.",
  "170 lbs.",
  "155 lbs.",
  "145 lbs.",
  "135 lbs.",
  "125 lbs.",
] as const

const WEIGHT_CLASS_NAMES = {
  "265 lbs.": "Heavyweight",
  "205 lbs.": "Light Heavyweight",
  "185 lbs.": "Middleweight",
  "170 lbs.": "Welterweight",
  "155 lbs.": "Lightweight",
  "145 lbs.": "Featherweight",
  "135 lbs.": "Bantamweight",
  "125 lbs.": "Flyweight",
} as const

const RANKING_TYPES = [
  { label: "All", value: "all" },
  { label: "Ranked", value: "ranked" },
  { label: "Unranked", value: "unranked" },
] as const

type WeightClass = typeof WEIGHT_CLASSES[number]
type RankingType = typeof RANKING_TYPES[number]['value']
type FilterValue = WeightClass | RankingType | "all"

interface FighterSearchProps {
  onSelectFighter: (fighter: Fighter) => void
  clearSearch?: boolean
  searchBarId?: string
}

interface SearchFilters {
  weightClass: WeightClass | null
  rankingType: RankingType
}

// Fighter display components
const FighterHistoryIcon = React.memo(() => (
  <History className="w-4 h-4 text-muted-foreground" />
));

const FighterBasicInfo = React.memo(({ name }: { name: string }) => (
  <span>{name}</span>
));

const FighterDetailedInfo = React.memo(({ fighter }: { fighter: string }) => {
  try {
    // Handle the case where fighter is undefined or empty
    if (!fighter) return <span>Unknown Fighter</span>;
    
    const [baseName, ...rest] = fighter.split('(');
    // Only attempt to join if there's something to join
    const info = rest.length > 0 ? '(' + rest.join('(') : '';
    return (
      <div className="flex flex-col">
        <span className="font-medium">{baseName.trim()}</span>
        {info && <span className="text-sm text-muted-foreground">{info}</span>}
      </div>
    );
  } catch (err) {
    console.error('Error creating fighter display element:', err);
    return <span>{fighter || 'Unknown Fighter'}</span>;
  }
});

// Add a constant for filter storage
const FILTER_STORAGE_KEY = "fighter-search-filters";

export function FighterSearch({ onSelectFighter, clearSearch, searchBarId }: FighterSearchProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [fighters, setFighters] = React.useState<Fighter[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const [searchHistory, setSearchHistory] = React.useState<Fighter[]>([])
  const [filters, setFilters] = React.useState<SearchFilters>({
    weightClass: null,
    rankingType: "all"
  })
  const [showFilters, setShowFilters] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const isComparePage = pathname?.includes('/fight-predictions/compare')
  
  // Load saved filters on component mount
  React.useEffect(() => {
    try {
      const savedFilters = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        setFilters(parsedFilters);
      }
    } catch (err) {
      console.error('Error loading saved filters:', err);
    }
    
    // Cleanup function to clear filters when component unmounts
    return () => {
      try {
        sessionStorage.removeItem(FILTER_STORAGE_KEY);
      } catch (err) {
        console.error('Error clearing filters on unmount:', err);
      }
    };
  }, []);
  
  // Determine which history key to use based on the searchBarId prop
  const historyKey = React.useMemo(() => {
    if (!isComparePage) return SEARCH_HISTORY_KEY;
    if (!searchBarId) return SEARCH_HISTORY_KEY;
    return `fighter-search-history-${searchBarId}`;
  }, [isComparePage, searchBarId]);

  // Load search history on mount
  React.useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(historyKey)
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory)
        if (Array.isArray(parsedHistory)) {
          const validHistory = parsedHistory
            .filter((item): item is Fighter => typeof item === 'object' && item.id)
            .slice(0, MAX_HISTORY_ITEMS)
          setSearchHistory(validHistory)
        }
      }
    } catch (err) {
      console.error('Error loading search history:', err)
      setSearchHistory([])
    }
  }, [historyKey])

  // Save search history
  const saveToHistory = (fighter: Fighter) => {
    try {
      // Get current history from localStorage for this specific search bar
      const currentHistory = localStorage.getItem(historyKey)
      let existingHistory: Fighter[] = []
      
      if (currentHistory) {
        try {
          const parsed = JSON.parse(currentHistory)
          if (Array.isArray(parsed)) {
            existingHistory = parsed
          }
        } catch (e) {
          console.error('Error parsing existing history:', e)
        }
      }

      // Remove any existing instance of this fighter and add to beginning
      const filteredHistory = existingHistory.filter(f => f.id !== fighter.id)
      const newHistory = [fighter, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS)
      
      // Update both state and localStorage
      setSearchHistory(newHistory)
      localStorage.setItem(historyKey, JSON.stringify(newHistory))
      
      // Only dispatch event for non-compare page
      if (!isComparePage) {
        window.dispatchEvent(new CustomEvent(SEARCH_HISTORY_EVENT))
      }
    } catch (err) {
      console.error('Error saving to history:', err)
    }
  }

  // Clear search history
  const clearHistory = () => {
    try {
      setSearchHistory([])
      localStorage.removeItem(historyKey)
      
      // Only dispatch event for non-compare page
      if (!isComparePage) {
        window.dispatchEvent(new CustomEvent(SEARCH_HISTORY_EVENT))
      }
    } catch (err) {
      console.error('Error clearing history:', err)
    }
  }

  // Listen for search history updates (only for non-compare page)
  React.useEffect(() => {
    if (isComparePage) return // Don't listen for updates on compare page

    const handleHistoryUpdate = () => {
      try {
        const storedHistory = localStorage.getItem(SEARCH_HISTORY_KEY)
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory)
          if (Array.isArray(parsedHistory)) {
            const validHistory = parsedHistory
              .filter((item): item is Fighter => typeof item === 'object' && item.id)
              .slice(0, MAX_HISTORY_ITEMS)
            setSearchHistory(validHistory)
          }
        }
      } catch (err) {
        console.error('Error updating search history:', err)
      }
    }

    window.addEventListener(SEARCH_HISTORY_EVENT, handleHistoryUpdate)
    return () => window.removeEventListener(SEARCH_HISTORY_EVENT, handleHistoryUpdate)
  }, [isComparePage])

  // Memoize expensive calculations
  const validFighters = React.useMemo(() => 
    fighters.filter(fighter => 
      fighter !== undefined && fighter !== null && typeof fighter === 'object' && fighter.id
    ), [fighters]);

  // Use callback for event handlers
  const handleFighterSelect = React.useCallback((fighter: Fighter) => {
    try {
      // Validate fighter object
      if (!fighter || typeof fighter !== 'object') {
        console.error('Invalid fighter object', fighter);
        return;
      }
      
      // Ensure fighter has an id
      if (!fighter.id) {
        console.error('Fighter missing ID', fighter);
        return;
      }
      
      // Close the suggestions dropdown and reset search
      setShowSuggestions(false);
      setSearchTerm("");
      setSelectedIndex(-1);
      
      // Add to history
      saveToHistory(fighter);
      
      const isComparisonPage = pathname?.includes('/fight-predictions/compare');
      
      if (isComparisonPage) {
        onSelectFighter(fighter);
        return; // Stop here for compare page
      }
      
      // Navigate to the fighter page using ID instead of slug
      router.push(`/fighters/${fighter.id}`);
    } catch (err) {
      console.error('Error selecting fighter:', err);
    }
  }, [onSelectFighter, pathname, router, saveToHistory]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only letters, numbers, and spaces
    const sanitizedValue = value.replace(/[^a-zA-Z0-9 ]/g, '');
    setSearchTerm(sanitizedValue);
    
    // Visual feedback when special characters are removed
    if (value !== sanitizedValue && inputRef.current) {
      inputRef.current.classList.add('shake-animation');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.classList.remove('shake-animation');
        }
      }, 500);
    }
    
    if (sanitizedValue) {
      setShowSuggestions(true);
    } else {
      setFighters([]);
    }
  }, []);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // Get current list of items to navigate
    const currentItems = searchTerm ? fighters : searchHistory;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < currentItems.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex(prev => prev > -1 ? prev - 1 : -1)
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex > -1 && currentItems[selectedIndex]) {
          handleFighterSelect(currentItems[selectedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }, [searchTerm, fighters, searchHistory, selectedIndex, handleFighterSelect]);

  const clearFilters = React.useCallback(() => {
    const clearedFilters: SearchFilters = {
      weightClass: null,
      rankingType: "all"
    };
    
    // Save cleared filters to sessionStorage
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(clearedFilters));
    } catch (err) {
      console.error('Error saving cleared filters:', err);
    }
    
    setFilters(clearedFilters);
  }, []);

  const getFighterDisplayElement = React.useCallback((fighter: Fighter, isHistory: boolean = false) => {
    // Check if fighter is null/undefined first
    if (!fighter) return <span>No fighter data</span>;
    
    // Ensure fighter.name is defined before using includes()
    // Use empty string as fallback if name is undefined
    const fighterName = fighter.name || '';
    
    return (
      <div className="flex items-center gap-2">
        {isHistory && <FighterHistoryIcon />}
        {!fighterName.includes('(') ? 
          <FighterBasicInfo name={fighterName} /> : 
          <FighterDetailedInfo fighter={fighterName} />}
      </div>
    );
  }, []);

  const handleFilterChange = React.useCallback((
    type: keyof SearchFilters,
    value: FilterValue,
    e?: Event
  ) => {
    // Prevent default behavior
    e?.preventDefault();
    
    const newFilters = {
      ...filters,
      [type]: value
    };
    
    // Save filters to sessionStorage
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(newFilters));
    } catch (err) {
      console.error('Error saving filters:', err);
    }
    
    setFilters(newFilters);
    // Don't clear the search term when changing filters
    // setSearchTerm("");
    setSelectedIndex(-1);
  }, [filters]);

  // Improved Framer Motion animations with variants
  const dropdownVariants = {
    hidden: { opacity: 0, y: -5 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.2,
        ease: "easeOut"
      } 
    },
    exit: { 
      opacity: 0,
      y: -5,
      transition: { 
        duration: 0.15,
        ease: "easeIn" 
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -5 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        duration: 0.1,
        ease: "easeOut"
      } 
    }
  };

  // Calculate active filters count only when filters change
  const activeFiltersCount = React.useMemo(() => 
    (filters.weightClass ? 1 : 0) + (filters.rankingType !== "all" ? 1 : 0),
    [filters.weightClass, filters.rankingType]
  );

  // Handle click outside to close suggestions
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
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
      setSelectedIndex(-1)
      // Don't clear filters to maintain filter state between searches
    }
  }, [clearSearch])

  // Reset selected index when fighters list changes
  React.useEffect(() => {
    setSelectedIndex(-1)
  }, [fighters])

  // Fetch fighters when search term or filters change
  React.useEffect(() => {
    const controller = new AbortController();
    
    const fetchFighters = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = new URL(ENDPOINTS.FIGHTERS_SEARCH(searchTerm.trim()));
        
        // Add weight class filter if selected - using exact database format
        if (filters.weightClass) {
          url.searchParams.append('weight_class', filters.weightClass);
        }
        
        // Add ranking filter if selected
        if (filters.rankingType !== "all") {
          url.searchParams.append('is_ranked', String(filters.rankingType === "ranked"));
        }

        const response = await fetch(url.toString(), {
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
        if (!data.fighters) {
          setFighters([]);
        } else {
          // API now returns an array of objects with name and id fields
          setFighters(data.fighters);
          // Explicitly force the suggestions to show when we have results
          if (data.fighters.length > 0) {
            setShowSuggestions(true);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch fighters');
        setFighters([]);
      } finally {
        setIsLoading(false);
      }
    }

    // Only fetch if we have a search term or active filters
    if (searchTerm.trim() || filters.weightClass || filters.rankingType !== "all") {
      const debounceTimer = setTimeout(fetchFighters, 300);
      return () => {
        clearTimeout(debounceTimer);
        controller.abort();
      };
    } else {
      setFighters([]);
      setShowSuggestions(false);
      return undefined;
    }
  }, [searchTerm, filters]);

  // Add focus event handler to input to ensure dropdown visibility
  const handleFocus = React.useCallback(() => {
    if (fighters.length > 0 || searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  }, [fighters.length, searchHistory.length]);

  // Optimization: use React.memo for CommandItem to prevent unnecessary re-renders
  const MemoizedCommandItem = React.memo(({ item, index, isHistory }: { 
    item: Fighter, 
    index: number, 
    isHistory?: boolean 
  }) => (
    <CommandItem
      value={item.name}
      key={`${item.name}-${index}`}
      className={cn(
        isMobile ? "py-2 px-2" : "py-2.5 px-4",
        selectedIndex === index && "bg-accent",
        "cursor-pointer md:transition-colors"
      )}
      onMouseEnter={() => setSelectedIndex(index)}
      onPointerDown={(e) => {
        e.preventDefault();
        handleFighterSelect(item);
      }}
      onSelect={() => handleFighterSelect(item)} 
    >
      {getFighterDisplayElement(item, isHistory)}
    </CommandItem>
  ));

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search fighters..."
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className={cn(
              isMobile 
                ? "w-full pl-9 pr-4 h-10"
                : "w-full pl-9 pr-4 h-12", // Taller input for desktop
              "bg-background/60 backdrop-blur-sm",
              "border border-white/20 rounded-lg",
              "placeholder:text-muted-foreground/70",
              "focus:ring-2 focus:ring-primary/50", // More prominent focus state
              "shadow-sm hover:shadow-md focus:shadow-lg", // Add depth on interaction
              "transition-all duration-200"
            )}
            aria-label="Search for fighters"
            aria-autocomplete="list"
            aria-controls="fighter-suggestions"
            aria-expanded={showSuggestions}
          />
          <Search className={cn(
            "absolute top-1/2 -translate-y-1/2",
            isMobile ? "left-3 h-4 w-4 text-muted-foreground" : "left-3 h-5 w-5 text-primary/70"
          )} />
        </div>

        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "relative shrink-0 h-10 w-10",
                "bg-background/60 backdrop-blur-sm",
                "border border-white/20 rounded-lg",
                "hover:bg-accent/50",
                "transition-all duration-200",
                showFilters && "bg-accent/50"
              )}
            >
              <Filter className="h-4 w-4" />
              {(filters.weightClass || filters.rankingType !== "all") && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[280px] p-4 bg-background/95 backdrop-blur-xl border-white/20"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none text-foreground">Weight Class</h4>
                <div className="relative">
                  <SimpleSelect
                    value={filters.weightClass ?? ""}
                    onValueChange={(value) => handleFilterChange("weightClass", value as WeightClass)}
                    options={[
                      { label: "All Weight Classes", value: "" },
                      ...WEIGHT_CLASSES.map((weight) => ({
                        label: WEIGHT_CLASS_NAMES[weight],
                        value: weight,
                      })),
                    ]}
                    className="w-full bg-background/50 border-white/20 text-foreground"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium leading-none text-foreground">Ranking</h4>
                <div className="relative">
                  <SimpleSelect
                    value={filters.rankingType}
                    onValueChange={(value) => handleFilterChange("rankingType", value as RankingType)}
                    options={RANKING_TYPES}
                    className="w-full bg-background/50 border-white/20 text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <AnimatePresence mode="wait">
        {showSuggestions && (searchTerm || searchHistory.length > 0) && (
          <motion.div
            className={cn(
              "absolute top-full left-0 right-0 mt-2 z-40",
              "bg-background/95 backdrop-blur-xl",
              "border border-white/20 rounded-lg shadow-xl",
              "overflow-hidden"
            )}
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Command className="rounded-lg border-0" shouldFilter={false}>
              {error && (
                <p className="p-4 text-sm text-destructive/90 text-center">
                  {error}
                </p>
              )}
              {isLoading ? (
                <div className="p-2 space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="px-2 py-1.5">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-2/3 mt-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {searchTerm.trim() ? (
                    <CommandGroup heading="Search Results">
                      {validFighters.length === 0 ? (
                        <CommandEmpty>No fighters found</CommandEmpty>
                      ) : (
                        validFighters.map((fighter, index) => (
                          <motion.div
                            key={`fighter-${fighter.name}-${index}`}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <MemoizedCommandItem 
                              key={`fighter-${fighter.name}-${index}`}
                              item={fighter} 
                              index={index}
                              isHistory={false} 
                            />
                          </motion.div>
                        ))
                      )}
                    </CommandGroup>
                  ) : searchHistory.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-sm text-muted-foreground">Recent Searches</span>
                        <button
                          onClick={clearHistory}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                      <CommandGroup>
                        {searchHistory.map((fighter, index) => (
                          <motion.div
                            key={`history-${fighter.name}-${index}`}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <MemoizedCommandItem 
                              key={`history-${fighter.name}-${index}`}
                              item={fighter} 
                              index={index}
                              isHistory={true} 
                            />
                          </motion.div>
                        ))}
                      </CommandGroup>
                    </>
                  ) : null}
                </>
              )}
            </Command>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 