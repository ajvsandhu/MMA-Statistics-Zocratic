"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import { API_URL, API_VERSION, ENDPOINTS } from "@/lib/api-config"
import { Badge } from "@/components/ui/badge"
import { useIsMobile, formatFighterUrl } from "@/lib/utils"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"

const FEATURED_FIGHTERS = [
  { name: "Jon Jones", stat: "26-1" },
  { name: "Israel Adesanya", stat: "24-2" },
  { name: "Alexander Volkanovski", stat: "26-4-0" },
  { name: "Islam Makhachev", stat: "24-1" },
]

export default function HomePage() {
  const [fightersCount, setFightersCount] = useState<number>(0)
  const [featuredFighters, setFeaturedFighters] = useState(FEATURED_FIGHTERS)
  const isMobile = useIsMobile()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch fighters count
        const countResponse = await fetch(`${API_URL}/api/${API_VERSION}/fighters-count`);
        const countData = await countResponse.json();
        setFightersCount(countData.count);

        // Fetch updated data for featured fighters
        const updatedFighters = await Promise.all(
          FEATURED_FIGHTERS.map(async (fighter) => {
            const response = await fetch(ENDPOINTS.FIGHTER(fighter.name));
            if (!response.ok) return fighter;
            const data = await response.json();
            return {
              name: fighter.name,
              stat: data.Record || fighter.stat
            };
          })
        );
        setFeaturedFighters(updatedFighters);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <PageTransition variant="default">
      <div className="container relative mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Center Badge */}
          <AnimatedItem variant="fadeDown" className="flex justify-center mb-8">
            <Badge variant="outline" className="py-2 px-4 backdrop-blur-sm border-primary/20 bg-card/50">
              <span className="text-primary mr-2">🥊</span>
              <span className="text-sm font-medium">Expert Fight Analysis & Predictions</span>
            </Badge>
          </AnimatedItem>

          {/* Main Title */}
          <AnimatedContainer className="text-center max-w-4xl mx-auto mb-12" delay={0.1}>
            <AnimatedItem variant="fadeUp" className="mb-6">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight">
                Master the
                <span className="bg-gradient-to-r from-primary via-blue-500 to-purple-500 text-transparent bg-clip-text"> Octagon</span>
              </h1>
            </AnimatedItem>
            <AnimatedItem variant="fadeUp" delay={0.1}>
              <p className="text-lg sm:text-xl text-muted-foreground">
                Your ultimate fight companion for predicting epic matchups. Get deep insights into every fighter's style, strengths, and path to victory
              </p>
            </AnimatedItem>
          </AnimatedContainer>

          {/* CTA Buttons */}
          <AnimatedItem variant="scale" delay={0.2} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/fight-predictions">
              <Button size="lg" className="bg-primary/90 hover:bg-primary text-primary-foreground px-8">
                Open App
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/fighters">
              <Button size="lg" variant="outline" className="bg-card/50 backdrop-blur border-primary/20 hover:bg-card/60 px-8">
                Discover More
              </Button>
            </Link>
          </AnimatedItem>

          {/* Stats Line */}
          <AnimatedContainer className="mb-16 sm:mb-20" delay={0.3}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 max-w-4xl mx-auto">
              {[
                { label: "Total Fighters", value: fightersCount.toLocaleString() },
                { label: "Predictions Made", value: "10,000+" },
                { label: "Fight Metrics", value: "25+" },
                { label: "Weight Classes", value: "9" },
              ].map((stat, index) => (
                <AnimatedItem key={index} variant="fadeUp" delay={0.1 * index} className="text-center">
                  <div className="text-xl sm:text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </AnimatedItem>
              ))}
            </div>
          </AnimatedContainer>

          {/* Featured Fighters Line */}
          <AnimatedItem variant="fadeIn" delay={0.4} className="relative w-full overflow-hidden">
            <div 
              className="animate-marquee whitespace-nowrap py-4"
              style={{
                animationDuration: `${isMobile ? 30 : 45}s`,
              }}
            >
              {[...featuredFighters, ...featuredFighters, ...featuredFighters].map((fighter, index) => (
                <Link 
                  key={index} 
                  href={`/fighters/${formatFighterUrl(fighter.name, fighter.stat)}`}
                  className="inline-flex items-center gap-2 mx-4 sm:mx-8 text-foreground/50 hover:text-foreground/90 transition-colors"
                >
                  <span className="text-sm font-medium">{fighter.name}</span>
                  <span className="text-xs text-muted-foreground">{fighter.stat}</span>
                  <span className="mx-2 sm:mx-4 text-border">•</span>
                </Link>
              ))}
            </div>
          </AnimatedItem>
        </div>
      </div>
    </PageTransition>
  )
}
