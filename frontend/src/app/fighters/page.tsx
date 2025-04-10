"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { FighterSearch } from "@/components/fighter-search"
import { FighterDetails } from "@/components/fighter-details"
import { formatFighterUrl } from "@/lib/utils"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function FightersContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedFighter, setSelectedFighter] = useState<string | null>(null)

  // Handle initial load and URL changes
  useEffect(() => {
    const name = searchParams.get('name') || searchParams.get('fighter')
    if (name) {
      setSelectedFighter(decodeURIComponent(name))
    }
  }, [searchParams])

  const handleFighterSelect = (name: string) => {
    // Extract the record from the fighter name string
    const recordMatch = name.match(/\(([^)]+)\)/);
    const record = recordMatch ? recordMatch[1] : '';
    const cleanName = name.split('(')[0].trim();
    
    // Format the URL
    const url = `/fighters/${formatFighterUrl(cleanName, record)}`;
    
    // Update the URL without changing the page
    window.history.pushState({}, '', url);
    
    // Update the selected fighter
    setSelectedFighter(name);
  }

  const handleBack = () => {
    setSelectedFighter(null)
    window.history.pushState({}, '', '/fighters')
  }

  return (
    <PageTransition variant="fade">
      <div className="container relative mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <AnimatedItem variant="fadeDown" className="text-center space-y-4 mb-16">
            <h1 className="text-4xl font-bold">UFC Fighters</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Explore detailed fighter statistics, rankings, and performance metrics
            </p>
          </AnimatedItem>

          <AnimatedItem 
            variant="fadeUp" 
            delay={0.2} 
            className="sticky top-24 z-50 max-w-2xl mx-auto w-full mb-16"
          >
            <FighterSearch 
              onSelectFighter={handleFighterSelect} 
              clearSearch={!!selectedFighter}
            />
          </AnimatedItem>

          {selectedFighter && (
            <AnimatedContainer delay={0.4} className="max-w-4xl mx-auto">
              <FighterDetails fighterName={selectedFighter} />
            </AnimatedContainer>
          )}
        </div>
      </div>
    </PageTransition>
  )
}

export default function FightersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FightersContent />
    </Suspense>
  )
}