"use client"

import { Check, Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme, THEMES_LIST, type Theme } from "@/lib/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium">Choose Theme</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEMES_LIST.map((themeOption) => (
          <Button
            key={themeOption.value}
            variant={theme === themeOption.value ? "default" : "outline"}
            onClick={() => setTheme(themeOption.value as Theme)}
            className={cn(
              "flex items-center gap-3 h-auto p-4 transition-all duration-200",
              "hover:scale-105 hover:shadow-md",
              theme === themeOption.value && "ring-2 ring-primary/20"
            )}
          >
            <div 
              className={cn(
                "w-4 h-4 rounded-full border-2",
                themeOption.value === "light" && "bg-zinc-200 border-zinc-300",
                themeOption.value === "dark" && "bg-zinc-800 border-zinc-700",
                themeOption.value === "theme-teal" && "bg-[#00e5e9] border-[#00aebb]",
                themeOption.value === "theme-purple" && "bg-purple-500 border-purple-600",
                themeOption.value === "theme-fire" && "bg-orange-500 border-orange-600",
                themeOption.value === "theme-huemint" && "bg-[#ca3f40] border-[#4b4643]",
                themeOption.value === "theme-crimson" && "bg-[#ca3f40] border-[#4b4643]",
              )}
            />
            <span className="text-sm font-medium">{themeOption.label}</span>
            {theme === themeOption.value && (
              <Check className="h-4 w-4 ml-auto" />
            )}
          </Button>
        ))}
      </div>
    </div>
  )
} 