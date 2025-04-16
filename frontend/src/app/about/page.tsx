"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/utils"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"

const TRANSITION_DURATION_MS = 700;
const OPACITY_DURATION_MS = 500;

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState(0)
  const [previousSection, setPreviousSection] = useState(-1)
  const sections = ["Overview", "Features", "Stay Tuned"]
  const isTransitioning = useRef(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  const isMobile = useIsMobile()
  const touchStartY = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref for the scroll container

  const changeSection = (newSection: number) => {
    if (
      isTransitioning.current ||
      newSection < 0 ||
      newSection >= sections.length ||
      newSection === activeSection
    ) {
      return
    }

    if (!hasScrolled) {
      setHasScrolled(true)
    }

    isTransitioning.current = true
    setPreviousSection(activeSection)
    setActiveSection(newSection)

    setTimeout(() => {
      isTransitioning.current = false
      setPreviousSection(-1) // Reset previous section after transition
    }, TRANSITION_DURATION_MS)
  }

  useEffect(() => {
    // Use the specific container for touch events if it exists
    const wheelTarget = document.documentElement;
    const touchTarget = scrollContainerRef.current;

    let wheelTimeoutId: NodeJS.Timeout
    const handleWheel = (e: WheelEvent) => {
      // Allow default scroll if modifier key is pressed (for accessibility/debugging)
      if (e.ctrlKey || e.metaKey || e.altKey) {
          return;
      }
      
      // Prevent default page scroll controlled by this component
      e.preventDefault();
      
      if (isTransitioning.current) {
        return
      }
      
      clearTimeout(wheelTimeoutId)
      wheelTimeoutId = setTimeout(() => {
        const direction = e.deltaY > 0 ? 1 : -1
        changeSection(activeSection + direction)
      }, 50) // Increased debounce slightly
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (isTransitioning.current) return
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTransitioning.current) return
      
      const touchEndY = e.changedTouches[0].clientY
      const deltaY = touchStartY.current - touchEndY
      
      // Reset touch start to prevent accidental multi-swipes if needed
      // touchStartY.current = 0;

      if (Math.abs(deltaY) > 40) { // Slightly reduced threshold
        e.preventDefault(); // Prevent default scroll since we are handling it
        const direction = deltaY > 0 ? 1 : -1
        changeSection(activeSection + direction)
      }
    }

    // Attach wheel listener to documentElement (as before)
    wheelTarget.addEventListener('wheel', handleWheel, { passive: false })
    
    // Attach touch listeners to the specific container IF it exists, regardless of isMobile flag
    if (touchTarget) { 
      touchTarget.addEventListener('touchstart', handleTouchStart, { passive: false })
      touchTarget.addEventListener('touchend', handleTouchEnd, { passive: false })
    }

    // Cleanup function
    return () => {
      clearTimeout(wheelTimeoutId)
      wheelTarget.removeEventListener('wheel', handleWheel)
      // Ensure cleanup checks if touchTarget existed
      if (touchTarget) { 
        touchTarget.removeEventListener('touchstart', handleTouchStart)
        touchTarget.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [activeSection, hasScrolled]) // Removed isMobile from dependency array as it's no longer conditional

  const scrollToSection = (index: number) => {
    if (isTransitioning.current) return
    changeSection(index)
  }

  const getSectionStyles = (index: number): React.CSSProperties => {
    const isActive = activeSection === index
    const isPrev = previousSection === index
    
    // Determine direction of movement for transform calculation
    let moveDirection = 0; 
    if (previousSection !== -1) { // Check if it's not the initial load
        moveDirection = activeSection > previousSection ? 1 : -1;
    }

    let transform = 'translateY(0)';
    let opacity = 0;
    let zIndex = 0;
    let visibility: 'visible' | 'hidden' = 'hidden'; // Default to hidden

    if (isActive) {
      transform = 'translateY(0)';
      opacity = 1;
      zIndex = 1; // Active is on top
      visibility = 'visible';
    } else if (isPrev) {
      // Previous section slides out based on the direction it was pushed
      transform = `translateY(${-moveDirection * 25}vh)`; // Slide out 25% of viewport height
      opacity = 0;
      zIndex = 0; // Keep behind active
      visibility = 'visible'; // Keep visible during its own transition
    } else {
      // Sections far away - determine initial position based on relation to *active*
      const initialDirection = index > activeSection ? 1 : -1;
      transform = `translateY(${initialDirection * 100}vh)`; // Position fully off-screen
      opacity = 0;
      zIndex = 0;
      visibility = 'hidden'; // Stays hidden
    }

    // Apply transition styles
    const isVisible = isActive || isPrev;
    const visibilityDelay = isVisible ? '0ms' : `${TRANSITION_DURATION_MS}ms`;

    return {
      transform,
      opacity,
      zIndex,
      visibility,
      transition: 
        `transform ${TRANSITION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), ` +
        `opacity ${OPACITY_DURATION_MS}ms ease-out, ` +
        `visibility 0ms linear ${visibilityDelay}`,
      pointerEvents: isActive ? 'auto' : 'none',
    };
  };


  return (
    <PageTransition variant="fade">
       {/* Scroll Indicator - Changed from fadeDown to fadeIn to prevent vertical movement */}
       <AnimatedItem variant="fadeIn" className="bottom-fixed">
         <div className={cn(
           "fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500",
           "pointer-events-none select-none",
           isMobile ? "bottom-28" : "bottom-8",
           hasScrolled ? "opacity-0 translate-y-4" : "opacity-100"
         )}>
           <div className="flex flex-col items-center gap-2">
             <div className="text-sm text-muted-foreground/80 font-medium">
               Scroll to explore
             </div>
             <div className="relative w-6 h-10 rounded-full border-2 border-muted-foreground/20 p-1">
               <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-scroll-bounce" />
             </div>
           </div>
         </div>
       </AnimatedItem>

       {/* Navigation */}
       <AnimatedItem variant="fadeIn" delay={0.1}>
         <div className={cn(
           "fixed z-40 transition-all duration-500",
           isMobile 
             ? "bottom-8 left-1/2 -translate-x-1/2" 
             : "right-8 top-1/2 -translate-y-1/2",
           !hasScrolled && "opacity-0 translate-y-4"
         )}>
           <div className={cn(
             "relative flex items-center backdrop-blur-md bg-background/60 border border-border/50 shadow-lg",
             isMobile 
               ? "flex-row gap-4 px-6 py-3 rounded-full" 
               : "flex-col gap-6 p-4 rounded-2xl"
           )}>
             {/* Progress Line */}
              <div className={cn(
                "absolute bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 before:absolute before:content-[''] before:inset-0",
                isMobile 
                  ? "h-[2px] left-6 right-6 top-[50%] -translate-y-1/2" 
                  : "w-[2px] top-4 bottom-4 left-0 right-0 mx-auto",
                "transition-transform duration-500 ease-out"
              )} style={{
                transform: isMobile 
                  ? `scaleX(${activeSection / (sections.length - 1)})` 
                  : `scaleY(${activeSection / (sections.length - 1)})`,
                transformOrigin: isMobile ? 'left' : 'top' // Ensure scaling starts from the beginning
              }} />

             {sections.map((section, index) => (
               <div key={index} className="relative group z-10"> {/* Ensure dots are above progress line */}
                 {/* Section Label */}
                 <div className={cn(
                   "absolute transition-all duration-300 px-3 py-1.5 rounded-md",
                   "bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg",
                   "opacity-0 scale-95 pointer-events-none", // Add pointer-events-none
                   isMobile 
                     ? "-top-12 left-1/2 -translate-x-1/2" 
                     : "right-full mr-4 top-1/2 -translate-y-1/2",
                   "group-hover:opacity-100 group-hover:scale-100", // Show on hover
                   // Keep active label potentially visible slightly longer if needed, or remove if hover is enough
                   // activeSection === index && "opacity-100 scale-100" 
                 )}>
                   <span className="text-sm font-medium whitespace-nowrap text-foreground">
                     {section}
                   </span>
                 </div>

                 {/* Navigation Dot */}
                 <button
                   onClick={() => scrollToSection(index)}
                   className={cn(
                     "relative flex items-center justify-center transition-transform duration-200",
                     "hover:scale-110",
                     isMobile ? "w-8 h-8" : "w-10 h-10"
                   )}
                 >
                   <div className={cn(
                     "absolute inset-0 rounded-full bg-gradient-to-r from-primary/40 to-primary/60",
                     "transition-all duration-300 ease-out",
                     activeSection === index ? "scale-100 opacity-100" : "scale-0 opacity-0"
                   )} />
                   <div className={cn(
                     "rounded-full transition-all duration-300",
                     isMobile ? "w-2.5 h-2.5" : "w-3 h-3",
                     activeSection === index 
                       ? "bg-primary scale-100" 
                       : "bg-muted-foreground/60 scale-75 group-hover:scale-90 group-hover:bg-primary/80"
                   )} />
                 </button>
               </div>
             ))}
           </div>
         </div>
       </AnimatedItem>

      {/* Content Sections Container - Added ref */}
      <div ref={scrollContainerRef} className="fixed inset-0 h-full w-full overflow-hidden">
        {sections.map((_, index) => (
          <section 
            key={index}
            className="absolute inset-0 h-full w-full flex items-center justify-center overflow-hidden p-4"
            style={getSectionStyles(index)}
          >
            {/* Section Inner Content Container */}
            <div className={cn(
              "container max-w-5xl px-4 relative",
            )}>
              {index === 0 && (
                <AnimatedContainer delay={0.1} className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6 md:space-y-8">
                  <AnimatedItem variant="fadeDown">
                    <div className={cn("inline-flex px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 backdrop-blur-sm")}>
                      <span className="text-primary text-xs sm:text-sm font-medium">UFC FIGHTER DATA API</span>
                    </div>
                  </AnimatedItem>
                  <AnimatedItem variant="fadeUp" delay={0.1}>
                    <h1 className={cn(
                      "font-bold text-foreground",
                      "text-4xl sm:text-5xl md:text-7xl"
                    )}>
                      Next Generation Fight Analytics
                    </h1>
                  </AnimatedItem>
                  <AnimatedItem variant="fadeUp" delay={0.15}>
                    <p className={cn(
                      "text-muted-foreground max-w-2xl mx-auto",
                      "text-base sm:text-lg md:text-xl"
                    )}>
                      A comprehensive API and analytics platform for UFC fighter statistics, providing real-time access to fighter data, match outcomes, and performance metrics.
                    </p>
                  </AnimatedItem>
                </AnimatedContainer>
              )}
               {index === 1 && (
                <AnimatedContainer delay={0.1} className="space-y-4 sm:space-y-8 md:space-y-12">
                  <AnimatedItem variant="fadeDown">
                    <h2 className={cn(
                      "font-bold text-foreground mb-3 sm:mb-4 md:mb-6",
                      "text-2xl sm:text-3xl md:text-4xl"
                    )}>Key Features</h2>
                    <p className={cn(
                      "text-muted-foreground",
                      "text-sm sm:text-base md:text-lg"
                    )}>
                      Discover the powerful features that make our UFC Fighter Data API the ultimate tool for fight analysis.
                    </p>
                  </AnimatedItem>
                  
                  <AnimatedContainer delay={0.2} className="grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 max-w-4xl mx-auto">
                    {[
                      { title: "Real-time Data", description: "Up-to-date fighter statistics and match outcomes, processed and available instantly" },
                      { title: "Comprehensive Stats", description: "Detailed metrics covering every aspect of fighter performance and history" },
                      { title: "RESTful API", description: "Well-documented endpoints for seamless integration with any application" },
                      { title: "Advanced Analytics", description: "Sophisticated analysis tools for deep insights into fighter performance" }
                    ].map((feature, idx) => (
                      <AnimatedItem key={idx} variant="fadeUp" delay={0.05 * idx} className={cn("group relative")}>
                        <div className="absolute -inset-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                        <div className="relative space-y-1 sm:space-y-2 md:space-y-3 px-1 py-3 sm:p-4">
                          <h3 className="font-semibold text-foreground text-base sm:text-lg md:text-xl">{feature.title}</h3>
                          <p className="text-muted-foreground text-xs sm:text-sm md:text-base">{feature.description}</p>
                        </div>
                      </AnimatedItem>
                    ))}
                  </AnimatedContainer>
                </AnimatedContainer>
               )}
               {index === 2 && (
                <AnimatedContainer delay={0.1} className="space-y-4 sm:space-y-6 md:space-y-8">
                  <AnimatedItem variant="fadeDown">
                    <h2 className={cn(
                      "font-bold text-foreground mb-3 sm:mb-4",
                      "text-2xl sm:text-3xl md:text-4xl"
                    )}>Stay Tuned</h2>
                    <p className={cn(
                      "text-muted-foreground",
                      "text-sm sm:text-base"
                    )}>We're actively developing new features and improvements to enhance your fight analysis experience.</p>
                  </AnimatedItem>
                  
                  <AnimatedContainer delay={0.2} className="grid md:grid-cols-2 gap-2 sm:gap-3 md:gap-4 max-w-4xl mx-auto">
                    {[
                      { title: "Event Analysis", description: "Coming soon: Comprehensive analysis of upcoming UFC events with detailed breakdowns and predictions for every fight on the card." },
                      { title: "Fighter Career Insights", description: "Deep dive into fighter careers with trend analysis, style matchups, and performance evolution over time." },
                      { title: "Advanced Statistics", description: "New metrics and visualizations to better understand fighter performance, including dynamic striking maps and grappling position analysis." },
                      { title: "Community Features", description: "Share your predictions, discuss matchups, and compete with other fight analysts in our upcoming community section." }
                    ].map((feature, idx) => (
                      <AnimatedItem key={idx} variant="fadeUp" delay={0.05 * idx} className={cn("group relative")}>
                        <div className="absolute -inset-2 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                        <div className="relative space-y-1 sm:space-y-1.5 px-1 py-2 sm:p-3">
                          <h3 className="font-semibold text-foreground text-base sm:text-lg">{feature.title}</h3>
                          <p className="text-muted-foreground leading-relaxed text-[11px] sm:text-xs">{feature.description}</p>
                        </div>
                      </AnimatedItem>
                    ))}
                  </AnimatedContainer>
                  
                  <AnimatedItem variant="fadeUp" delay={0.3} className={cn("text-center max-w-2xl mx-auto")}>
                    <p className="text-muted-foreground text-xs sm:text-sm">Follow our updates as we continue to improve and expand the platform with new features and insights.</p>
                  </AnimatedItem>
                </AnimatedContainer>
               )}
            </div>
          </section>
        ))}
      </div>
    </PageTransition>
  )
} 