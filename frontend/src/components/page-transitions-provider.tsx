"use client"

import { ReactNode } from "react"
import { AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

interface PageTransitionsProviderProps {
  children: ReactNode
}

export function PageTransitionsProvider({ children }: PageTransitionsProviderProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={true}>
      {/* 
        The key prop ensures that when the pathname changes,
        AnimatePresence will trigger exit animations on the old component
        before mounting the new one
      */}
      <div key={pathname}>
        {children}
      </div>
    </AnimatePresence>
  )
} 