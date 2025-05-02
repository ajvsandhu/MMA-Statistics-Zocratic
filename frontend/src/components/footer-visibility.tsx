"use client"

import { usePathname } from "next/navigation"
import { SiteFooter } from "@/components/site-footer"

// This component hides the footer on fighter details pages (e.g. /fighters/1234) and the About page
export function FooterVisibility() {
  const pathname = usePathname()
  // If the path matches /fighters/[something] exactly, or is /about, don't show the footer
  const isFighterPage = /^\/fighters\/[^/]+$/.test(pathname)
  const isAboutPage = pathname === "/about"
  if (isFighterPage || isAboutPage) return null
  return <SiteFooter />
} 