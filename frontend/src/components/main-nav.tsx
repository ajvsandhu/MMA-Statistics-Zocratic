"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export function MainNav() {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = React.useState(false)
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
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

  return (
    <>
      <Link href="/" className="font-bold text-lg mr-6">
        ZOCRATIC
      </Link>
      <div className={cn(
        "flex items-center space-x-1",
        isMobile ? "overflow-x-auto no-scrollbar" : "space-x-2"
      )}>
        {links.map(({ href, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative px-3 py-1.5 text-sm font-medium transition-colors",
                "hover:text-[var(--nav-text-hover)]",
                "rounded-full",
                isMobile ? "flex-shrink-0 text-xs px-2" : "",
                isActive ? "text-[var(--nav-text)]" : "text-muted-foreground"
              )}
            >
              {label}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-[var(--nav-bg-active)] rounded-full"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
} 