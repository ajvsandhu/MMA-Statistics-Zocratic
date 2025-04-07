"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { getAnimationVariants } from '@/lib/animations'
import { useIsMobile } from "@/lib/utils"

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState(0)
  const sections = ["Overview", "Features", "Stay Tuned"]
  const containerRef = useRef<HTMLDivElement>(null)
  const [isManualScroll, setIsManualScroll] = useState(false)
  const [direction, setDirection] = useState(0)
  const isMobile = useIsMobile()
  const animationVariants = getAnimationVariants(isMobile)

  useEffect(() => {
    const container = containerRef.current?.querySelector('div')
    if (!container) return

    let lastScrollTop = 0
    let touchStartY = 0
    let touchEndY = 0
    let scrollTimeout: NodeJS.Timeout

    const handleWheel = (e: WheelEvent) => {
      if (isManualScroll) {
        e.preventDefault()
        return
      }
      
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        const delta = e.deltaY
        const newDirection = delta > 0 ? 1 : -1
        
        setDirection(newDirection)
        const nextSection = activeSection + newDirection
        
        if (nextSection >= 0 && nextSection < sections.length) {
          setIsManualScroll(true)
          setActiveSection(nextSection)
          container.scrollTo({
            top: nextSection * window.innerHeight,
            behavior: 'smooth'
          })
          setTimeout(() => setIsManualScroll(false), 1000)
        }
      }, 50) // Debounce scroll events
    }

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isManualScroll) {
        e.preventDefault()
        return
      }
      touchEndY = e.touches[0].clientY
    }

    const handleTouchEnd = () => {
      if (isManualScroll) return
      
      const delta = touchStartY - touchEndY
      if (Math.abs(delta) < 50) return // Minimum swipe distance

      const newDirection = delta > 0 ? 1 : -1
      const nextSection = activeSection + newDirection
      
      if (nextSection >= 0 && nextSection < sections.length) {
        setIsManualScroll(true)
        setDirection(newDirection)
        setActiveSection(nextSection)
        container.scrollTo({
          top: nextSection * window.innerHeight,
          behavior: 'smooth'
        })
        setTimeout(() => setIsManualScroll(false), 1000)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      clearTimeout(scrollTimeout)
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [activeSection, sections.length, isManualScroll])

  const scrollToSection = (index: number) => {
    const container = containerRef.current?.querySelector('div')
    if (!container || isManualScroll) return

    setDirection(index > activeSection ? 1 : -1)
    setIsManualScroll(true)
    setActiveSection(index)

    container.scrollTo({
      top: index * window.innerHeight,
      behavior: 'smooth'
    })

    setTimeout(() => setIsManualScroll(false), 1000)
  }

  return (
    <div className="fixed inset-0 bg-background">
      {/* Navigation Legend - Updated positioning and styling */}
      <div className={cn(
        "fixed z-50 transition-all duration-300",
        isMobile 
          ? "bottom-6 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border border-border/50 shadow-lg" 
          : "right-8 top-1/2 -translate-y-1/2"
      )}>
        <div className={cn(
          "flex items-center relative",
          isMobile ? "flex-row gap-3" : "flex-col gap-6"
        )}>
          {isMobile ? (
            <div 
              className="absolute inset-y-[15px] left-0 right-0 h-[2px] bg-muted-foreground/10"
              style={{
                transform: `scaleX(${(sections.length - 1) * 100}%)`
              }}
            />
          ) : (
            <div 
              className="absolute right-[19px] top-0 bottom-0 w-[2px] bg-muted-foreground/20"
              style={{
                transform: `scaleY(${(sections.length - 1) * 100}%)`
              }}
            />
          )}
          {sections.map((section, index) => (
            <div key={index} className="relative">
              {!isMobile && (
                <motion.div
                  className="absolute right-full mr-6 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border/50"
                  initial={false}
                  animate={{
                    opacity: activeSection === index ? 1 : 0,
                    x: activeSection === index ? 0 : 20,
                    scale: activeSection === index ? 1 : 0.95
                  }}
                  transition={{ duration: 0.4 }}
                >
                  <span className="text-sm font-medium whitespace-nowrap text-foreground">
                    {section}
                  </span>
                </motion.div>
              )}
              <button
                onClick={() => scrollToSection(index)}
                className={cn(
                  "relative flex items-center justify-center group",
                  isMobile ? "w-8 h-8" : "w-10 h-10"
                )}
              >
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/20"
                  initial={false}
                  animate={{
                    scale: activeSection === index ? 1 : 0,
                    opacity: activeSection === index ? 1 : 0
                  }}
                  transition={{ duration: 0.3 }}
                />
                <motion.div
                  className={cn(
                    "rounded-full",
                    isMobile ? "w-2 h-2" : "w-2.5 h-2.5"
                  )}
                  initial={false}
                  animate={{
                    scale: activeSection === index ? 1 : 0.8,
                    backgroundColor: activeSection === index ? 'var(--primary)' : 'var(--muted-foreground)'
                  }}
                  transition={{ duration: 0.3 }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div 
        ref={containerRef}
        className="h-screen w-full overflow-hidden"
      >
        <div className="h-full w-full overflow-y-auto overflow-x-hidden scrollbar-none snap-y snap-mandatory">
          <AnimatePresence initial={false} mode="wait">
            {sections.map((_, index) => (
              <motion.section 
                key={index}
                id={`section-${index}`}
                className="h-screen w-full flex items-center justify-center relative snap-start"
                initial={{ 
                  opacity: 0,
                  y: isMobile ? 0 : (direction > 0 ? 100 : -100)
                }}
                animate={{ 
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: isMobile ? 0.2 : 0.6,
                    ease: [0.16, 1, 0.3, 1]
                  }
                }}
                exit={{ 
                  opacity: 0,
                  y: isMobile ? 0 : (direction > 0 ? -100 : 100),
                  transition: {
                    duration: isMobile ? 0.15 : 0.6,
                    ease: [0.16, 1, 0.3, 1]
                  }
                }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                />
                <motion.div
                  className="container max-w-5xl px-4"
                  initial={{ opacity: 0, y: isMobile ? 0 : 40 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    transition: {
                      duration: isMobile ? 0.2 : 0.8,
                      delay: isMobile ? 0.1 : 0.2,
                      ease: [0.16, 1, 0.3, 1]
                    }
                  }}
                >
                  {index === 0 && (
                    <div className="max-w-3xl mx-auto text-center space-y-8">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="inline-flex px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm"
                      >
                        <span className="text-primary text-sm font-medium">UFC FIGHTER DATA API</span>
                      </motion.div>
                      <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="text-5xl sm:text-7xl font-bold text-foreground"
                      >
                        Next Generation Fight Analytics
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="text-xl text-muted-foreground max-w-2xl mx-auto"
                      >
                        A comprehensive API and analytics platform for UFC fighter statistics, providing real-time access to
                        fighter data, match outcomes, and performance metrics.
                      </motion.p>
                    </div>
                  )}

                  {index === 1 && (
                    <div className="space-y-16">
                      <div className="max-w-2xl mx-auto text-center">
                        <motion.h2
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6 }}
                          className="text-4xl font-bold text-foreground mb-6"
                        >
                          Key Features
                        </motion.h2>
                        <motion.p
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className="text-xl text-muted-foreground"
                        >
                          Discover the powerful features that make our UFC Fighter Data API the ultimate tool for fight analysis.
                        </motion.p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {[
                          {
                            title: "Real-time Data",
                            description: "Up-to-date fighter statistics and match outcomes, processed and available instantly"
                          },
                          {
                            title: "Comprehensive Stats",
                            description: "Detailed metrics covering every aspect of fighter performance and history"
                          },
                          {
                            title: "RESTful API",
                            description: "Well-documented endpoints for seamless integration with any application"
                          },
                          {
                            title: "Advanced Analytics",
                            description: "Sophisticated analysis tools for deep insights into fighter performance"
                          }
                        ].map((feature, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ 
                              duration: 0.6,
                              delay: idx * 0.1
                            }}
                            className="group relative"
                          >
                            <div className="absolute -inset-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                            <div className="relative space-y-4 p-4">
                              <h3 className="text-2xl font-semibold text-foreground">{feature.title}</h3>
                              <p className="text-muted-foreground text-lg">{feature.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {index === 2 && (
                    <div className="space-y-16">
                      <div className="max-w-2xl mx-auto text-center">
                        <motion.h2
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6 }}
                          className="text-4xl font-bold text-foreground mb-6"
                        >
                          Stay Tuned
                        </motion.h2>
                        <motion.p
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className="text-xl text-muted-foreground"
                        >
                          We're actively developing new features and improvements to enhance your fight analysis experience.
                        </motion.p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[
                          {
                            title: "Event Analysis",
                            description: "Coming soon: Comprehensive analysis of upcoming UFC events with detailed breakdowns and predictions for every fight on the card."
                          },
                          {
                            title: "Fighter Career Insights",
                            description: "Deep dive into fighter careers with trend analysis, style matchups, and performance evolution over time."
                          },
                          {
                            title: "Advanced Statistics",
                            description: "New metrics and visualizations to better understand fighter performance, including dynamic striking maps and grappling position analysis."
                          },
                          {
                            title: "Community Features",
                            description: "Share your predictions, discuss matchups, and compete with other fight analysts in our upcoming community section."
                          }
                        ].map((feature, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ 
                              duration: 0.6,
                              delay: idx * 0.1
                            }}
                            className="group relative"
                          >
                            <div className="absolute -inset-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                            <div className="relative space-y-4 p-4">
                              <h3 className="text-2xl font-semibold text-foreground">{feature.title}</h3>
                              <p className="text-muted-foreground text-lg">{feature.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="text-center max-w-2xl mx-auto"
                      >
                        <p className="text-muted-foreground text-lg">
                          Follow our updates as we continue to improve and expand the platform with new features and insights.
                        </p>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-none {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        
        html, body {
          overflow: hidden;
          height: 100vh;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  )
} 