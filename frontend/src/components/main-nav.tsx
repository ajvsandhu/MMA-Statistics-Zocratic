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
    <nav className="flex items-center space-x-6">
      <Link
        href="/"
        className="text-lg font-semibold hover:text-primary transition-colors"
      >
        ZOCRATIC
      </Link>
      <div className="relative">
        <div className="flex items-center space-x-2">
          {links.map((link) => {
            const isActive = link.href === '/' 
              ? pathname === '/'
              : pathname.startsWith(link.href)
            
            return (
              <motion.div
                key={link.href}
                {...(isMobile ? mobileNavAnimation : {
                  initial: { opacity: 0, y: -10 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.3 }
                })}
              >
                <Link
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-full relative text-sm font-medium transition-colors",
                    "hover:text-primary",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-full bg-muted"
                      style={{
                        zIndex: -1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </nav>
  )
} 