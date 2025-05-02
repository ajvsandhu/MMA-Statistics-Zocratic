"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { FighterSearch } from "@/components/fighter-search"
import { FighterDetails } from "@/components/fighter-details"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn, createFighterSlug } from "@/lib/utils"

// Define Fighter interface matching the one in FighterSearch
interface Fighter {
  id: string;
  name: string;
}

function FightersContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedFighter, setSelectedFighter] = useState<Fighter | null>(null)
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false)

  // Handle initial load and URL changes - maintain backward compatibility with query params
  useEffect(() => {
    const name = searchParams.get('name') || searchParams.get('fighter')
    if (name) {
      // If query parameters are used, redirect to the new ID-based URL if available
      // For backward compatibility we still support name-based redirects
      const slug = createFighterSlug(name)
      setIsRedirecting(true)
      router.replace(`/fighters/${slug}`)
    }
  }, [searchParams, router])

  const handleFighterSelect = (fighter: Fighter) => {
    // Navigate to the fighter details page using the ID-based URL
    router.push(`/fighters/${fighter.id}`)
    
    // Also update the selected fighter
    setSelectedFighter(fighter)
  }

  // Show loading state during redirect
  if (isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
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
              <FighterDetails fighterId={selectedFighter.id} />
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