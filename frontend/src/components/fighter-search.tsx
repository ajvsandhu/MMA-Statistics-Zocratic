"use client"

import * as React from "react"
import { Check, Search, History, X, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { formatFighterUrl } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface Fighter {
  name: string;
  record: string;
}

const SEARCH_HISTORY_KEY = "fighter-search-history"
const MAX_HISTORY_ITEMS = 5

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
  onSelectFighter: (fighter: string) => void
  clearSearch?: boolean
}

interface SearchFilters {
  weightClass: WeightClass | null
  rankingType: RankingType
}

export function FighterSearch({ onSelectFighter, clearSearch }: FighterSearchProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [fighters, setFighters] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const [searchHistory, setSearchHistory] = React.useState<string[]>([])
  const [filters, setFilters] = React.useState<SearchFilters>({
    weightClass: null,
    rankingType: "all"
  })
  const [showFilters, setShowFilters] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Load search history on mount
  React.useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (history) {
      setSearchHistory(JSON.parse(history))
    }
  }, [])

  // Save search history
  const saveToHistory = (fighter: string) => {
    const newHistory = [fighter, ...searchHistory.filter(f => f !== fighter)].slice(0, MAX_HISTORY_ITEMS)
    setSearchHistory(newHistory)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory))
  }

  // Clear search history
  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(searchTerm ? fighters : searchHistory)]
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex(prev => prev > -1 ? prev - 1 : -1)
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex > -1 && items[selectedIndex]) {
          handleFighterSelect(items[selectedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

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
          setFighters(data.fighters);
        }
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

    // Only fetch if we have a search term or active filters
    if (searchTerm.trim() || filters.weightClass || filters.rankingType !== "all") {
      const debounceTimer = setTimeout(fetchFighters, 300);
      return () => {
        clearTimeout(debounceTimer);
        controller.abort();
      };
    } else {
      setFighters([]);
      return undefined;
    }
  }, [searchTerm, filters]);

  const handleFighterSelect = (fighterName: string) => {
    try {
      // Extract the record from the fighter name string
      const recordMatch = fighterName.match(/\(([^)]+)\)/);
      const record = recordMatch ? recordMatch[1] : '';
      const cleanName = fighterName.split('(')[0].trim();
      
      // Update the UI state
      setShowSuggestions(false);
      setSearchTerm("");
      setSelectedIndex(-1);
      saveToHistory(fighterName);
      
      // Finally call the onSelectFighter callback
      onSelectFighter(fighterName);
    } catch (err) {
      console.error('Error processing fighter selection:', err);
    }
  };

  const handleFilterChange = (
    type: keyof SearchFilters,
    value: FilterValue,
    e?: Event
  ) => {
    // Prevent default behavior
    e?.preventDefault();
    
    setFilters(prev => ({
      ...prev,
      [type]: value
    }))
    setSearchTerm("")
    setSelectedIndex(-1)
  }

  const clearFilters = () => {
    setFilters({
      weightClass: null,
      rankingType: "all"
    });
  };

  const activeFiltersCount = (filters.weightClass ? 1 : 0) + (filters.rankingType !== "all" ? 1 : 0)

  const getFighterDisplayElement = (fighter: string, isHistory: boolean = false) => {
    if (!fighter) return <span>No name</span>;
    
    if (!fighter.includes('(')) return (
      <div className="flex items-center gap-2">
        {isHistory && <History className="w-4 h-4 text-muted-foreground" />}
        <span>{fighter}</span>
      </div>
    );

    try {
      const [baseName, ...rest] = fighter.split('(');
      const info = '(' + rest.join('(');
      return (
        <div className="flex items-center gap-2">
          {isHistory && <History className="w-4 h-4 text-muted-foreground" />}
          <div className="flex flex-col">
            <span className="font-medium">{baseName.trim()}</span>
            <span className="text-sm text-muted-foreground">{info}</span>
          </div>
        </div>
      );
    } catch (err) {
      console.error('Error creating fighter display element:', err);
      return <span>{fighter}</span>;
    }
  }
  
  const validFighters = fighters.filter(fighter => 
    fighter !== undefined && fighter !== null && typeof fighter === 'string'
  );

  return (
    <div ref={wrapperRef} className="relative w-full" onKeyDown={handleKeyDown}>
      <div className="flex gap-3">
        <div className="relative group flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            placeholder="Search fighters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            className={cn(
              "w-full pl-11 pr-10 h-12",
              "bg-white/10 dark:bg-white/5",
              "hover:bg-white/15 dark:hover:bg-white/10",
              "focus:bg-white/20 dark:focus:bg-white/15",
              "border-white/20",
              "ring-0",
              "shadow-lg",
              "rounded-2xl text-base text-foreground placeholder:text-muted-foreground"
            )}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-background/20 dark:hover:bg-background/40"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
        
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-12 w-[5.5rem] rounded-2xl bg-background/50 hover:bg-background/80",
                "border-white/20 text-foreground font-medium relative",
                "shadow-lg backdrop-blur-sm",
                activeFiltersCount > 0 && "ring-2 ring-white/20"
              )}
            >
              <span className="mr-1">Filters</span>
              <Filter className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-background/90 text-foreground text-xs"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[280px] p-4 rounded-lg border-border/10 bg-background/95 backdrop-blur-lg shadow-xl" 
            align="end" 
            sideOffset={4}
            style={{ zIndex: 51 }}
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

      {showSuggestions && (searchTerm.trim() || isLoading || error || searchHistory.length > 0) && (
        <div className="absolute top-[calc(100%+0.5rem)] w-full z-50 rounded-lg border border-border/10 bg-background/95 backdrop-blur-lg text-foreground shadow-xl overflow-hidden">
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
                        <CommandItem
                          key={fighter}
                          value={fighter}
                          onSelect={() => handleFighterSelect(fighter)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            index === selectedIndex && "bg-accent"
                          )}
                        >
                          {getFighterDisplayElement(fighter)}
                        </CommandItem>
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
                        <CommandItem
                          key={fighter}
                          value={fighter}
                          onSelect={() => handleFighterSelect(fighter)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            index === selectedIndex && "bg-accent"
                          )}
                        >
                          {getFighterDisplayElement(fighter, true)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                ) : null}
              </>
            )}
          </Command>
        </div>
      )}
    </div>
  );
} 