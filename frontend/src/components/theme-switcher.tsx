"use client"

import { useState, useRef, useEffect } from "react"
import { Check, Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme, THEMES_LIST, type Theme } from "@/lib/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-9 px-0"
        onClick={() => setOpen(!open)}
      >
        <Palette className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      
      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[150px] rounded-md border border-border bg-popover shadow-md z-50">
          {THEMES_LIST.map((themeOption) => (
            <button
              key={themeOption.value}
              onClick={() => {
                setTheme(themeOption.value as Theme)
                setOpen(false)
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                theme === themeOption.value && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <div 
                  className={cn(
                    "w-4 h-4 rounded-full",
                    themeOption.value === "light" && "bg-zinc-200 border border-zinc-300",
                    themeOption.value === "dark" && "bg-zinc-800 border border-zinc-700",
                    themeOption.value === "theme-teal" && "bg-[#00e5e9] border border-[#00aebb]",
                    themeOption.value === "theme-purple" && "bg-purple-500 border border-purple-600",
                    themeOption.value === "theme-fire" && "bg-orange-500 border border-orange-600",
                    themeOption.value === "theme-huemint" && "bg-[#ca3f40] border border-[#4b4643]",
                    themeOption.value === "theme-crimson" && "bg-[#ca3f40] border border-[#4b4643]",
                  )}
                />
                <span className="text-sm">{themeOption.label}</span>
              </div>
              {theme === themeOption.value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 