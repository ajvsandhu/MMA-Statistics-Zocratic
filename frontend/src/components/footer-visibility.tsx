"use client"

import { usePathname } from "next/navigation"
import { SiteFooter } from "@/components/site-footer"

// This component hides the footer on fighter details pages (e.g. /fighters/1234), About page, and Compare page
export function FooterVisibility() {
  const pathname = usePathname()
  // If the path matches /fighters/[something] exactly, or is /about, or is /fight-predictions/compare, don't show the footer
  const isFighterPage = /^\/fighters\/[^/]+$/.test(pathname)
  const isAboutPage = pathname === "/about"
  const isComparePage = pathname === "/fight-predictions/compare"
  if (isFighterPage || isAboutPage || isComparePage) return null
  return <SiteFooter />
} 