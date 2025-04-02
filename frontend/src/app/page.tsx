"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { ArrowRight, Swords, Brain, LineChart, Users, Shield, Target, RefreshCw, Trophy, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"

export default function HomePage() {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()

  // More natural scroll animation
  useEffect(() => {
    const unsubscribe = scrollY.onChange(y => {
      setIsScrolled(y > 10)
    })
    return () => unsubscribe()
  }, [scrollY])

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features')
    featuresSection?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <motion.div 
      className="relative min-h-screen bg-gradient-to-b from-background to-background/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Grid Background with Animated Gradient */}
      <div className="fixed inset-0">
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
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background opacity-80" />
        
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-[500px] h-[500px] rounded-full"
              style={{
                background: `radial-gradient(circle, ${
                  i === 0 ? 'rgba(147, 51, 234, 0.03)' : 
                  i === 1 ? 'rgba(59, 130, 246, 0.03)' : 
                  'rgba(236, 72, 153, 0.03)'
                } 0%, transparent 70%)`,
                left: `${i * 30}%`,
                top: `${i * 20 - 50}%`,
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 15 + i * 5,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section ref={heroRef} className="relative min-h-screen flex items-center px-4">
          <div className="container max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Main Content */}
              <motion.div
                className="space-y-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="relative inline-block"
                >
                  <motion.div
                    className="absolute -inset-4 rounded-full"
                    style={{
                      background: "radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)"
                    }}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <div className="relative flex items-center gap-4">
                    <motion.div
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    >
                      <Swords className="w-16 h-16 text-primary" />
                    </motion.div>
                  </div>
                </motion.div>

                <motion.h1 
                  className="text-5xl lg:text-8xl font-bold"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <span className="block mb-2">Predict</span>
                  <motion.span 
                    className="block bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-500 leading-[1.1] pb-2"
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    style={{ backgroundSize: '200% 100%' }}
                  >
                    UFC Fights
                  </motion.span>
                </motion.h1>
                
                <motion.p 
                  className="text-xl lg:text-2xl text-muted-foreground max-w-xl mt-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  Experience the future of fight analysis with AI-powered predictions and comprehensive fighter statistics
                </motion.p>

                {/* Hero CTA */}
                <motion.div 
                  className="flex flex-col sm:flex-row items-start gap-4 pt-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Link href="/fight-predictions">
                    <motion.div
                      onHoverStart={() => setHoveredButton('predictions')}
                      onHoverEnd={() => setHoveredButton(null)}
                      className="relative"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-blue-500/20 rounded-lg blur-xl"
                        animate={{
                          opacity: hoveredButton === 'predictions' ? 1 : 0,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                      <Button
                        size="lg"
                        className="relative bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-semibold"
                      >
                        <span className="mr-2">Try Fight Predictions</span>
                        <motion.span
                          animate={{
                            x: hoveredButton === 'predictions' ? 5 : 0,
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <ArrowRight className="w-5 h-5" />
                        </motion.span>
                      </Button>
                    </motion.div>
                  </Link>

                  <Link href="/fighters">
                    <motion.div
                      onHoverStart={() => setHoveredButton('fighters')}
                      onHoverEnd={() => setHoveredButton(null)}
                      className="relative"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-primary/20 rounded-lg blur-xl"
                        animate={{
                          opacity: hoveredButton === 'fighters' ? 1 : 0,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                      <Button
                        size="lg"
                        variant="outline"
                        className="relative border-primary/20 hover:bg-primary/10 px-8 py-6 text-lg font-semibold"
                      >
                        <span className="mr-2">Explore Fighters</span>
                        <motion.span
                          animate={{
                            x: hoveredButton === 'fighters' ? 5 : 0,
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <ArrowRight className="w-5 h-5" />
                        </motion.span>
                      </Button>
                    </motion.div>
                  </Link>
                </motion.div>
              </motion.div>

              {/* Right Side - Stats Preview */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="relative lg:h-[600px] hidden lg:block"
              >
                <div className="relative h-full grid grid-cols-2 gap-6 p-6">
                  {[
                    { 
                      label: "Accuracy Rate", 
                      value: "85%+",
                      gradient: "from-primary via-purple-500 to-blue-500",
                      glowColor: "rgba(147, 51, 234, 0.15)"
                    },
                    { 
                      label: "Active Users", 
                      value: "500+",
                      gradient: "from-primary via-purple-500 to-blue-500",
                      glowColor: "rgba(147, 51, 234, 0.15)"
                    },
                    { 
                      label: "Predictions Made", 
                      value: "10K+",
                      gradient: "from-primary via-purple-500 to-blue-500",
                      glowColor: "rgba(147, 51, 234, 0.15)"
                    },
                    { 
                      label: "Live Updates", 
                      value: "24/7",
                      gradient: "from-primary via-purple-500 to-blue-500",
                      glowColor: "rgba(147, 51, 234, 0.15)"
                    }
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 + (index * 0.1) }}
                      className="relative group"
                      whileHover={{ y: -5, scale: 1.02 }}
                    >
                      <div 
                        className="absolute -inset-0.5 rounded-2xl opacity-30 group-hover:opacity-60 transition duration-300"
                        style={{
                          background: `linear-gradient(to bottom right, ${stat.gradient})`,
                          filter: 'blur(1px)'
                        }}
                      />
                      <div className="relative h-full p-6 rounded-2xl bg-background/60 backdrop-blur-sm border border-white/5 flex flex-col justify-center">
                        <div 
                          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300"
                          style={{
                            background: `radial-gradient(circle at center, ${stat.glowColor}, transparent 70%)`
                          }}
                        />
                        <motion.div 
                          className={`text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${stat.gradient}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * index }}
                        >
                          {stat.value}
                        </motion.div>
                        <motion.div 
                          className="text-sm font-medium text-muted-foreground mt-3"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 * index }}
                        >
                          {stat.label}
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Enhanced Scroll Indicator */}
            <motion.div
              className="fixed left-1/2 -translate-x-1/2 bottom-8 flex flex-col items-center gap-2 cursor-pointer z-50"
              onClick={scrollToFeatures}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: isScrolled ? 0 : 1,
                y: isScrolled ? 20 : 0
              }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative w-4 h-7 rounded-full border-2 border-primary p-1"
                whileHover={{ scale: 1.1 }}
              >
                <motion.div
                  className="w-1 h-1 bg-primary rounded-full mx-auto"
                  animate={{
                    y: [0, 8, 0]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
              <motion.p
                className="text-[10px] uppercase tracking-widest font-semibold text-primary"
                animate={{
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                Scroll
              </motion.p>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative py-32 bg-gradient-to-b from-background to-background/90">
          <div className="container max-w-6xl mx-auto px-4">
        <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
            >
              {[
                {
                  title: "AI-Powered Predictions",
                  description: "Get accurate fight predictions powered by advanced machine learning and real-time data analysis.",
                  icon: Brain,
                  gradient: "from-blue-500/20 via-indigo-500/20 to-purple-500/20"
                },
                {
                  title: "Comprehensive Stats",
                  description: "Explore detailed fighter statistics, including striking accuracy, grappling efficiency, and fight control metrics.",
                  icon: LineChart,
                  gradient: "from-emerald-500/20 via-teal-500/20 to-cyan-500/20"
                },
                {
                  title: "Live Updates",
                  description: "Stay up-to-date with real-time fighter statistics and performance metrics.",
                  icon: RefreshCw,
                  gradient: "from-orange-500/20 via-amber-500/20 to-yellow-500/20"
                },
                {
                  title: "Fighter Analysis",
                  description: "Deep dive into fighter profiles, matchup history, and performance trends.",
                  icon: Target,
                  gradient: "from-red-500/20 via-rose-500/20 to-pink-500/20"
                },
                {
                  title: "Win Predictions",
                  description: "Get detailed probability breakdowns and winning scenarios for each fighter.",
                  icon: Trophy,
                  gradient: "from-violet-500/20 via-purple-500/20 to-fuchsia-500/20"
                },
                {
                  title: "Community Insights",
                  description: "Join a community of MMA enthusiasts and share your fight analysis.",
                  icon: Users,
                  gradient: "from-cyan-500/20 via-blue-500/20 to-indigo-500/20"
                }
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  transition={{ duration: 0.5 }}
                  className="relative group"
                  whileHover={{ y: -5 }}
                >
                  <div className="h-full p-8 rounded-2xl bg-background/40 backdrop-blur-sm border border-white/10 relative overflow-hidden">
                    <motion.div
                      className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl", `bg-gradient-to-r ${feature.gradient}`)}
                    />
                    <div className="relative">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-6">
                        <feature.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="relative py-32 bg-gradient-to-b from-background/90 to-background">
          <div className="container max-w-6xl mx-auto px-4">
            <motion.div
              className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 p-12 border border-white/10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
              />
              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="space-y-4 text-center lg:text-left">
                  <motion.h2 
                    className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-500"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                  >
                    Ready to Predict Your First Fight?
                  </motion.h2>
                  
                  <motion.p 
                    className="text-xl text-muted-foreground max-w-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                  >
                    Join thousands of MMA enthusiasts using advanced AI to predict fight outcomes
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  viewport={{ once: true }}
                >
                  <Link href="/fight-predictions">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="relative"
                    >
                      <Button
                        size="lg"
                        className="relative bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-semibold"
                      >
                        Start Predicting Now
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </motion.div>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </motion.div>
  )
}
