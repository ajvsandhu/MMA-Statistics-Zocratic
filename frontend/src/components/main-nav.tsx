"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/fighters", label: "Fighters" },
  { href: "/fight-predictions", label: "Fight Predictions" },
  { href: "/about", label: "About" },
]

const NAV_LINK_STYLES = "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"

export function MainNav() {
  const pathname = usePathname()

  return (
    <div className="mr-4 flex">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <motion.span 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70"
        >
          Zocratic
        </motion.span>
      </Link>
      <NavigationMenu>
        <NavigationMenuList className="space-x-2">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = pathname === href
            return (
              <NavigationMenuItem key={href}>
                <Link href={href} legacyBehavior passHref>
                  <NavigationMenuLink 
                    className={cn(
                      NAV_LINK_STYLES,
                      isActive && "bg-accent/50 text-accent-foreground"
                    )}
                  >
                    {label}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            )
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
} 