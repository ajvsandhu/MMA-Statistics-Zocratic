"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useTheme, THEMES_LIST, type Theme } from "@/lib/theme-provider"
import { Check, Palette } from "lucide-react"

export function MainNav() {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = React.useState(false)
  const { theme, setTheme } = useTheme()
  
  React.useEffect(() => {
    const checkMobile = () => {
      const newIsMobile = window.innerWidth <= 768
      if (newIsMobile !== isMobile) {
        setIsMobile(newIsMobile)
        // Close mobile menu when switching between mobile/desktop
        if (!newIsMobile) {
          setMobileMenuOpen(false)
          setThemeMenuOpen(false)
        }
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [isMobile])

  // Close mobile menu when pathname changes
  React.useEffect(() => {
    setMobileMenuOpen(false)
    setThemeMenuOpen(false)
  }, [pathname])

  // Close menu when clicking outside or pressing escape
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuOpen && event.target instanceof Element) {
        // Don't close if clicking on the menu button or menu content
        const menuButton = event.target.closest('[aria-label="Toggle navigation menu"]')
        const menuContent = event.target.closest('[data-mobile-menu]')
        if (!menuButton && !menuContent) {
          setMobileMenuOpen(false)
          setThemeMenuOpen(false)
        }
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (themeMenuOpen) {
          setThemeMenuOpen(false)
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false)
        }
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen, themeMenuOpen])
  
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
      href: "/fight-predictions/events",
      label: "Event Analysis",
    },
    {
      href: "/zobot",
      label: "Zobot AI",
    },
    {
      href: "/about",
      label: "About",
    },
    {
      href: "/contact",
      label: "Contact Us",
    },
  ]

  // Mobile menu animation variants
  const menuVariants = {
    closed: {
      opacity: 0,
      y: -10,
      scale: 0.95,
    },
    open: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
  }

  const itemVariants = {
    closed: { opacity: 0, x: -20 },
    open: { opacity: 1, x: 0 },
  }

  if (isMobile) {
    return (
      <>
        <Link href="/" className="font-bold text-lg">
          ZOCRATIC
        </Link>
        <div className="flex-1" />
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="relative z-50 hover:bg-white/10"
            aria-label="Toggle navigation menu"
          >
            <AnimatePresence mode="wait">
              {mobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="h-5 w-5" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>

          {/* Mobile Menu Dropdown */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                {/* Backdrop with strong blur - excludes navbar area */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[60]"
                  style={{ 
                    clipPath: 'polygon(0 80px, 100% 80px, 100% 100%, 0 100%)'
                  }}
                  onClick={() => setMobileMenuOpen(false)}
                />
                
                {/* Menu Content */}
                <motion.div
                  variants={menuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-full right-0 mt-3 w-72 rounded-3xl border border-[var(--nav-border)] bg-[hsl(var(--background))] backdrop-blur-2xl shadow-2xl z-[70]"
                  data-mobile-menu
                >
                  <div className="p-3">
                    {/* Navigation Links */}
                    {links.map(({ href, label }, index) => {
                      const isActive = pathname === href
                      return (
                        <motion.div
                          key={href}
                          variants={itemVariants}
                          initial="closed"
                          animate="open"
                          transition={{ delay: index * 0.05, duration: 0.2 }}
                        >
                          <Link
                            href={href}
                            className={cn(
                              "flex items-center w-full px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-200",
                              "hover:bg-[var(--nav-bg-active)] hover:text-[var(--nav-text-hover)]",
                              isActive ? "bg-[var(--nav-bg-active)] text-[var(--nav-text)] font-semibold" : "text-muted-foreground"
                            )}
                            onClick={() => {
                              setMobileMenuOpen(false)
                              setThemeMenuOpen(false)
                            }}
                          >
                            {label}
                          </Link>
                        </motion.div>
                      )
                    })}
                    
                    {/* Separator */}
                    <motion.div
                      variants={itemVariants}
                      initial="closed"
                      animate="open"
                      transition={{ delay: links.length * 0.05, duration: 0.2 }}
                      className="my-2 h-px bg-border"
                    />
                    
                    {/* Theme Switcher */}
                    <motion.div
                      variants={itemVariants}
                      initial="closed"
                      animate="open"
                      transition={{ delay: (links.length + 1) * 0.05, duration: 0.2 }}
                      className="relative"
                    >
                      <button
                        onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-200",
                          "hover:bg-[var(--nav-bg-active)] hover:text-[var(--nav-text-hover)]",
                          themeMenuOpen ? "bg-[var(--nav-bg-active)] text-[var(--nav-text)]" : "text-muted-foreground"
                        )}
                      >
                        <span>Theme</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs opacity-60">
                            {THEMES_LIST.find(t => t.value === theme)?.label || "Dark"}
                          </span>
                          <Palette className="h-4 w-4" />
                        </div>
                      </button>
                      
                      {/* Theme Options */}
                      <AnimatePresence>
                        {themeMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-[hsl(var(--background))] backdrop-blur-2xl border border-[var(--nav-border)] rounded-2xl shadow-xl z-[80] overflow-hidden"
                          >
                            {THEMES_LIST.map((themeOption, index) => (
                              <motion.button
                                key={themeOption.value}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03, duration: 0.15 }}
                                onClick={() => {
                                  setTheme(themeOption.value as Theme)
                                  setThemeMenuOpen(false)
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-4 py-3 text-sm transition-all duration-200",
                                  "hover:bg-[var(--nav-bg-active)] hover:text-[var(--nav-text-hover)]",
                                  theme === themeOption.value ? "bg-[var(--nav-bg-active)] text-[var(--nav-text)] font-semibold" : "text-muted-foreground"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div 
                                    className={cn(
                                      "w-3 h-3 rounded-full border",
                                      themeOption.value === "light" && "bg-zinc-200 border-zinc-400",
                                      themeOption.value === "dark" && "bg-zinc-800 border-zinc-600",
                                      themeOption.value === "theme-teal" && "bg-[#00e5e9] border-[#00aebb]",
                                      themeOption.value === "theme-purple" && "bg-purple-500 border-purple-600",
                                      themeOption.value === "theme-fire" && "bg-orange-500 border-orange-600",
                                      themeOption.value === "theme-crimson" && "bg-[#ca3f40] border-[#4b4643]",
                                    )}
                                  />
                                  <span>{themeOption.label}</span>
                                </div>
                                {theme === themeOption.value && <Check className="h-3 w-3" />}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </>
    )
  }

  // Desktop Navigation
  return (
    <>
      <Link href="/" className="font-bold text-lg mr-6">
        ZOCRATIC
      </Link>
      <div className="flex items-center space-x-2">
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