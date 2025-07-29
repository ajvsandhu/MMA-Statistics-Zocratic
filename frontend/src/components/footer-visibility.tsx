"use client"

import { usePathname } from "next/navigation"
import { SiteFooter } from "@/components/site-footer"

// This component hides the footer on homepage, fighter details pages, About page, and Compare page
export function FooterVisibility() {
  const pathname = usePathname()
  // If the path matches /fighters/[something] exactly, or is /, /about, or /fight-predictions/compare, don't show the footer
  const isHomePage = pathname === "/"
  const isFighterPage = /^\/fighters\/[^/]+$/.test(pathname)
  const isAboutPage = pathname === "/about"
  const isComparePage = pathname === "/fight-predictions/compare"
  if (isHomePage || isFighterPage || isAboutPage || isComparePage) return null
  return <SiteFooter />
} 