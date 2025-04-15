"use client"

import { ReactNode } from "react"
import { motion, Variants } from "framer-motion"
import { useIsMobile } from "@/lib/utils"
import {
  pageVariants,
  containerVariants,
  fadeUpVariants,
  fadeDownVariants,
  fadeInVariants,
  slideInLeftVariants,
  slideInRightVariants,
  scaleUpVariants,
  getResponsiveVariants
} from "@/lib/animations"

interface PageTransitionProps {
  children: ReactNode
  className?: string
  variant?: "default" | "fade" | "slide-up" | "slide-down" | "scale"
}

export function PageTransition({
  children,
  className = "",
  variant = "default"
}: PageTransitionProps) {
  const isMobile = useIsMobile()
  
  // Select the appropriate animation variant based on the prop
  const getVariant = () => {
    switch (variant) {
      case "fade":
        return getResponsiveVariants(fadeInVariants, { isMobile })
      case "slide-up":
        return getResponsiveVariants(fadeUpVariants, { isMobile })
      case "slide-down":
        return getResponsiveVariants(fadeDownVariants, { isMobile })
      case "scale":
        return getResponsiveVariants(scaleUpVariants, { isMobile })
      case "default":
      default:
        return getResponsiveVariants(pageVariants, { isMobile })
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={getVariant()}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Additional components for specific content blocks
export function AnimatedContainer({
  children,
  className = "",
  delay = 0
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const isMobile = useIsMobile()
  const variants = getResponsiveVariants(containerVariants, { isMobile })
  
  // Apply custom delay if provided
  if (delay > 0 && variants.visible) {
    variants.visible = {
      ...variants.visible,
      transition: {
        ...(variants.visible as any).transition,
        delay
      }
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function AnimatedItem({
  children,
  className = "",
  variant = "fadeUp",
  delay = 0
}: {
  children: ReactNode
  className?: string
  variant?: "fadeUp" | "fadeDown" | "fadeIn" | "slideLeft" | "slideRight" | "scale"
  delay?: number
}) {
  const isMobile = useIsMobile()
  
  const getVariant = () => {
    switch (variant) {
      case "fadeUp":
        return getResponsiveVariants(fadeUpVariants, { isMobile })
      case "fadeDown":
        return getResponsiveVariants(fadeDownVariants, { isMobile })
      case "fadeIn":
        return getResponsiveVariants(fadeInVariants, { isMobile })
      case "slideLeft":
        return getResponsiveVariants(slideInLeftVariants, { isMobile })
      case "slideRight":
        return getResponsiveVariants(slideInRightVariants, { isMobile })
      case "scale":
        return getResponsiveVariants(scaleUpVariants, { isMobile })
      default:
        return getResponsiveVariants(fadeUpVariants, { isMobile })
    }
  }

  const variants = getVariant()
  
  // Apply custom delay if provided
  if (delay > 0 && variants.visible) {
    variants.visible = {
      ...variants.visible,
      transition: {
        ...(variants.visible as any).transition,
        delay
      }
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
} 