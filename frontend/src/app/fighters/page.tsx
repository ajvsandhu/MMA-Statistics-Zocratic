"use client"

import { useState } from "react"
import { FighterSearch } from "@/components/fighter-search"
import { FighterDetails } from "@/components/fighter-details"
import { motion, AnimatePresence } from "framer-motion"
import { Swords, Star, TrendingUp, Medal, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export default function FightersPage() {
  const [selectedFighter, setSelectedFighter] = useState<string | null>(null)

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-background/80">
      {/* Grid Background */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-background/50" />

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.span
            key={i}
            className={cn(
              "absolute w-1 h-1 bg-primary/40 rounded-full",
              i % 2 === 0 && "w-2 h-2",
              i % 3 === 0 && "bg-primary/60"
            )}
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            initial={{ opacity: 0 }}
            animate={{
              y: [0, Math.random() * 400 - 200, 0],
              x: [0, Math.random() * 400 - 200, 0],
              scale: [1, Math.random() + 0.5, 1],
              opacity: [0, 0.4, 0.8, 0.4],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear",
              opacity: { duration: 1, delay: i * 0.1 }
            }}
          />
        ))}
      </div>

      <div className="container relative z-10 mx-auto px-4 py-16 max-w-6xl">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8 flex items-center justify-center"
          >
            <div className="p-4 rounded-full bg-primary/5 backdrop-blur-sm">
              <Swords className="w-12 h-12 text-primary" />
            </div>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80"
          >
            UFC Fighters
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
          >
            Explore detailed fighter statistics, rankings, and performance metrics
          </motion.p>
        </motion.div>

        {/* Enhanced Search Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative z-50 w-full max-w-lg mx-auto mb-20"
        >
          <div className="relative">
            <div className="relative bg-background/40 backdrop-blur-md rounded-lg ring-1 ring-white/10 shadow-lg">
              <FighterSearch 
                onSelectFighter={(fighter) => {
                  setSelectedFighter(fighter)
                }}
                clearSearch={!selectedFighter} 
              />
            </div>
          </div>
        </motion.div>

        {/* Content Section */}
        <div className="relative z-40">
          <AnimatePresence mode="wait">
            {selectedFighter ? (
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.5 }}
                className="w-full"
              >
                <div className="relative bg-background/40 backdrop-blur-md rounded-lg ring-1 ring-white/10 shadow-lg overflow-hidden">
                  <FighterDetails fighterName={selectedFighter} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {[
                  {
                    icon: Star,
                    title: "Quick Stats",
                    description: "Access comprehensive fighter statistics and performance metrics at a glance."
                  },
                  {
                    icon: Medal,
                    title: "Rankings",
                    description: "Stay updated with current UFC rankings across all weight classes."
                  },
                  {
                    icon: TrendingUp,
                    title: "Fight History",
                    description: "Review detailed fight histories and career progression."
                  }
                ].map((card, i) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="group relative"
                  >
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative bg-background/40 backdrop-blur-md rounded-lg p-8 ring-1 ring-white/10 shadow-md transition-all duration-300 hover:bg-background/60">
                      <div className="mb-6">
                        <div className="inline-block p-3 bg-primary/5 rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/10">
                          <card.icon className="w-8 h-8 text-primary transition-colors duration-300" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-3 text-foreground">
                        {card.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
} 