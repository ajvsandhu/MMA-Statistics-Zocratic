"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useMediaQuery } from '@/hooks/use-media-query'

export function MainNav() {
  const pathname = usePathname()
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const links = [
    {
      href: "/",
      label: "Home",
    },
    {
      href: "/fighters",
      label: "Fighters",
    },
    {
      href: "/fight-predictions",
      label: "Fight Predictions",
    },
    {
      href: "/about",
      label: "About",
    },
  ]

  // Mobile-specific animations
  const mobileNavAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.15 }
  }

  return (
    <nav className={cn(
      "fixed top-0 inset-x-0 z-50",
      "bg-background/95 backdrop-blur-md border-b",
      "px-4 h-[65px] flex items-center",
      isMobile ? "justify-between" : "justify-start"
    )}>
      <Link href="/" className="font-bold text-lg mr-6">
        ZOCRATIC
      </Link>
      <div className={cn(
        "flex items-center gap-1",
        isMobile ? "overflow-x-auto no-scrollbar" : "gap-2"
      )}>
        {links.map(({ href, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative px-3 py-1.5 text-sm font-medium transition-colors",
                "rounded-md hover:bg-accent/50",
                isMobile ? "flex-shrink-0 text-xs px-2" : "",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-accent/50 rounded-md -z-10"
                  {...(isMobile ? mobileNavAnimation : {})}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
} 