"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export function MainNav() {
  const pathname = usePathname()

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
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
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
            )
          })}
        </div>
      </div>
    </nav>
  )
} 