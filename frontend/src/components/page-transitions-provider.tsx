"use client"

import { ReactNode, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

interface PageTransitionsProviderProps {
  children: ReactNode
}

export function PageTransitionsProvider({ children }: PageTransitionsProviderProps) {
  const pathname = usePathname()

  useEffect(() => {
    // Always scroll the window to the top on route change
    window.scrollTo(0, 0);
    // If you have a main content container, scroll it to the top too
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
  }, [pathname]);

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