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

const NAV_LINK_STYLES = "group relative inline-flex h-9 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"

export function MainNav() {
  const pathname = usePathname()

  return (
    <motion.div 
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mr-4 flex items-center"
    >
      <Link href="/" className="mr-8 flex items-center">
        <motion.span 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-lg font-bold tracking-wider text-foreground"
        >
          ZOCRATIC
        </motion.span>
      </Link>
      <NavigationMenu>
        <NavigationMenuList className="flex items-center space-x-1">
          {NAV_ITEMS.map(({ href, label }, index) => {
            const isActive = pathname === href
            return (
              <NavigationMenuItem key={href}>
                <Link href={href} legacyBehavior passHref>
                  <NavigationMenuLink 
                    className={cn(
                      NAV_LINK_STYLES,
                      isActive 
                        ? "bg-accent text-accent-foreground" 
                        : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground data-[active]:bg-accent/50 data-[active]:text-accent-foreground"
                    )}
                  >
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ 
                        delay: 0.1 + index * 0.05,
                        duration: 0.2
                      }}
                      className="relative"
                    >
                      {label}
                    </motion.span>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            )
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </motion.div>
  )
} 