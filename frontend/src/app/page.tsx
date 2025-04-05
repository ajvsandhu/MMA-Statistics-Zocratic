"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import { API_URL, API_VERSION } from "@/lib/api-config"
import { Badge } from "@/components/ui/badge"
import { formatFighterUrl } from "@/lib/utils"

const FEATURED_FIGHTERS = [
  { name: "Jon Jones", stat: "26-1" },
  { name: "Israel Adesanya", stat: "24-2" },
  { name: "Alexander Volkanovski", stat: "25-3" },
  { name: "Islam Makhachev", stat: "24-1" },
]

export default function HomePage() {
  const [fightersCount, setFightersCount] = useState<number>(0)

  useEffect(() => {
    const fetchFightersCount = async () => {
      try {
        const response = await fetch(`${API_URL}/api/${API_VERSION}/fighters-count`);
        const data = await response.json();
        setFightersCount(data.count);
      } catch (error) {
        console.error('Error fetching fighters count:', error);
      }
    };

    fetchFightersCount();
  }, []);

  return (
    <div className="container relative mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Center Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-8"
        >
          <Badge variant="outline" className="py-2 px-4 backdrop-blur-sm border-primary/20 bg-card/50">
            <span className="text-primary mr-2">🥊</span>
            <span className="text-sm font-medium">Expert Fight Analysis & Predictions</span>
          </Badge>
        </motion.div>

        {/* Main Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center max-w-4xl mx-auto mb-12"
        >
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6">
            Master the
            <span className="bg-gradient-to-r from-primary via-blue-500 to-purple-500 text-transparent bg-clip-text"> Octagon</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Your ultimate fight companion for predicting epic matchups. Get deep insights into every fighter's style, strengths, and path to victory
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
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
        </motion.div>

        {/* Stats Line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-20"
        >
          {[
            { label: "Total Fighters", value: fightersCount.toLocaleString() },
            { label: "Predictions Made", value: "10,000+" },
            { label: "Accuracy Rate", value: "73%" },
            { label: "Weight Classes", value: "8" },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Featured Fighters Line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="relative w-full overflow-hidden"
        >
          <div className="animate-marquee whitespace-nowrap py-4">
            {[...FEATURED_FIGHTERS, ...FEATURED_FIGHTERS, ...FEATURED_FIGHTERS].map((fighter, index) => (
              <Link 
                key={index} 
                href={`/fighters/${formatFighterUrl(fighter.name, fighter.stat)}`}
                className="inline-flex items-center gap-2 mx-8 text-foreground/50 hover:text-foreground/90 transition-colors"
              >
                <span className="text-sm font-medium">{fighter.name}</span>
                <span className="text-xs text-muted-foreground">{fighter.stat}</span>
                <span className="mx-4 text-border">•</span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
