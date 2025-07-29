"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, User, LogOut, Settings as SettingsIcon, BarChart3, Sparkles, Shield, Search, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useTheme, THEMES_LIST, type Theme } from "@/lib/theme-provider"
import { Check, Palette } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { FighterSearch } from "@/components/fighter-search"
import { useRouter } from "next/navigation"

// Utility function to check if user is admin
const isUserAdmin = (idToken: string | undefined): boolean => {
  if (!idToken) {
    return false;
  }
  
  try {
    // Decode JWT token (simple base64 decode of payload)
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const groups = payload['cognito:groups'] || payload['groups'] || [];
    const isAdmin = Array.isArray(groups) && groups.includes('admin');
    return isAdmin;
  } catch (error) {
    return false;
  }
};

// Define Fighter interface
interface Fighter {
  id: string;
  name: string;
}

export function MainNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobile, setIsMobile] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = React.useState(false)
  const [mobileSearchExpanded, setMobileSearchExpanded] = React.useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false)
  const { theme, setTheme } = useTheme()
  const { isAuthenticated, isLoading, userProfile, signOut, getIdToken } = useAuth()
  
  // Check if we're on a fighters page
  const isFightersPage = pathname?.startsWith('/fighters')

  React.useEffect(() => {
    const checkMobile = () => {
      const newIsMobile = window.innerWidth <= 768
      if (newIsMobile !== isMobile) {
        setIsMobile(newIsMobile)
        // Close mobile menu when switching between mobile/desktop
        if (!newIsMobile) {
          setMobileMenuOpen(false)
          setThemeMenuOpen(false)
          setMobileSearchExpanded(false)
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
    setMobileSearchExpanded(false)
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
      
      // Close mobile search if clicking outside (only on mobile) - but don't close menu
      if (isMobile && mobileSearchExpanded && event.target instanceof Element) {
        const searchContainer = event.target.closest('[data-mobile-search-container]')
        const menuContent = event.target.closest('[data-mobile-menu]')
        if (!searchContainer && !menuContent) {
          setMobileSearchExpanded(false)
        }
      }
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (isMobile && mobileSearchExpanded && event.target instanceof Element) {
        const searchContainer = event.target.closest('[data-mobile-search-container]')
        const menuContent = event.target.closest('[data-mobile-menu]')
        if (!searchContainer && !menuContent) {
          setMobileSearchExpanded(false)
        }
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      // Close search on any swipe/touch movement outside the search area - but preserve menu
      if (isMobile && mobileSearchExpanded && event.target instanceof Element) {
        const searchContainer = event.target.closest('[data-mobile-search-container]')
        const menuContent = event.target.closest('[data-mobile-menu]')
        if (!searchContainer && !menuContent) {
          setMobileSearchExpanded(false)
        }
      }
    }

    const handleScroll = () => {
      // Close search on scroll but keep menu open
      if (isMobile && mobileSearchExpanded) {
        setMobileSearchExpanded(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileSearchExpanded) {
          setMobileSearchExpanded(false)
        } else if (themeMenuOpen) {
          setThemeMenuOpen(false)
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false)
        }
      }
    }

    if (mobileMenuOpen || mobileSearchExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
      document.addEventListener('touchmove', handleTouchMove, { passive: true })
      document.addEventListener('scroll', handleScroll, { passive: true })
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when menu is open
      if (mobileMenuOpen) {
        document.body.style.overflow = 'hidden'
      }
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('scroll', handleScroll)
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen, themeMenuOpen, mobileSearchExpanded, isMobile])

  const handleSignOut = async () => {
    try {
      await signOut()
      setMobileMenuOpen(false)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleFighterSelect = (fighter: Fighter) => {
    // Navigate to the fighter details page
    router.push(`/fighters/${fighter.id}`)
    // Close the mobile search only, keep menu open
    setMobileSearchExpanded(false)
  }
  
  const links = [
    { href: "/", label: "Home" },
    { href: "/fight-predictions", label: "Predictions" },
    { href: "/fight-predictions/events", label: "Events" },
    { href: "/leaderboard", label: "P4P Leaderboard" },
    { href: "/zobot", label: "Zobot" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" }
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

  const mobileSearchVariants = {
    collapsed: { 
      width: 40,
      x: 0,
      transition: { 
        duration: 0.3, 
        ease: "easeInOut"
      }
    },
    expanded: { 
      width: "calc(100vw - 170px)", 
      x: -60, 
      transition: { 
        duration: 0.3, 
        ease: "easeInOut"
      }
    }
  }

  // Logo fade animation variants with improved timing
  const logoVariants = {
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.3, 
        ease: "easeInOut"
      }
    },
    hidden: { 
      opacity: 0,
      transition: { 
        duration: 0.2, 
        ease: "easeInOut"
      }
    }
  }

  // Content animation variants
  const contentVariants = {
    icon: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.15 }
    },
    input: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2, delay: 0.1 }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.15 }
    }
  }

  if (isMobile) {
    return (
      <>
        <motion.div
          variants={logoVariants}
          animate={mobileSearchExpanded ? "hidden" : "visible"}
        >
          <Link href="/" className="font-light text-lg sm:text-xl text-foreground">
            ZOCRATIC
          </Link>
        </motion.div>
        <div className="flex-1" />
        
        {/* Mobile Search Bar - Expandable - Hidden on fighters pages */}
        {pathname && !pathname.startsWith('/fighters') && (
          <div className="flex items-center gap-2 relative z-[10000]" data-mobile-search-container>
            <motion.div
              variants={mobileSearchVariants}
              animate={mobileSearchExpanded ? "expanded" : "collapsed"}
              className="relative"
            >
              <AnimatePresence mode="wait">
                {mobileSearchExpanded ? (
                  <motion.div
                    key="search-input"
                    variants={contentVariants}
                    initial="exit"
                    animate="input"
                    exit="exit"
                    className="w-full"
                  >
                    <FighterSearch 
                      onSelectFighter={handleFighterSelect}
                      clearSearch={false}
                      autoFocus={true}
                    />
                  </motion.div>
                ) : (
                  <motion.button
                    key="search-icon"
                    variants={contentVariants}
                    initial="exit"
                    animate="icon"
                    exit="exit"
                    onClick={() => setMobileSearchExpanded(true)}
                    className="flex items-center justify-center w-10 h-10 transition-all duration-200 focus:outline-none focus:ring-0"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    aria-label="Search fighters"
                  >
                    <Search className="h-5 w-5 text-white" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        <div className="relative z-[10001]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="relative z-50 hover:bg-white/10 rounded-xl h-10 w-10 focus:outline-none focus:ring-0"
            style={{ WebkitTapHighlightColor: 'transparent' }}
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
                  className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[20000]"
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
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--nav-border)] bg-[hsl(var(--background))]/95 backdrop-blur-xl shadow-2xl z-[20010]"
                  style={{
                    // Ensure menu stays positioned correctly even when search expands
                    transform: mobileSearchExpanded ? 'translateX(-60px)' : 'translateX(0px)',
                    transition: 'transform 0.3s ease-in-out'
                  }}
                  data-mobile-menu
                >
                  <div className="p-4">
                    {/* Authentication Section */}
                    {!isLoading && (
                      <motion.div
                        variants={itemVariants}
                        initial="closed"
                        animate="open"
                        transition={{ delay: 0, duration: 0.2 }}
                        className="mb-4"
                      >
                        {isAuthenticated ? (
                          <div className="space-y-3">
                            {/* Account Dropdown Header */}
                            <button
                              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 hover:from-primary/20 hover:to-secondary/20 transition-all duration-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                                  <User className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <p className="text-sm font-semibold text-[var(--nav-text)] truncate">
                                    {userProfile.preferred_username || userProfile.email || 'User'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Member
                                  </p>
                                </div>
                              </div>
                              <motion.div
                                animate={{ rotate: accountMenuOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </motion.div>
                            </button>

                            {/* Account Dropdown Content */}
                            <AnimatePresence>
                              {accountMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-1 pl-4">
                                    <Link
                                      href="/settings"
                                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 hover:bg-[var(--nav-bg-active)] text-[var(--nav-text)]"
                                      onClick={() => setMobileMenuOpen(false)}
                                    >
                                      <SettingsIcon className="h-4 w-4" />
                                      <span>Settings</span>
                                    </Link>
                                    <Link
                                      href="/dashboard"
                                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 hover:bg-[var(--nav-bg-active)] text-[var(--nav-text)]"
                                      onClick={() => setMobileMenuOpen(false)}
                                    >
                                      <BarChart3 className="h-4 w-4" />
                                      <span>Dashboard</span>
                                    </Link>
                                    {isUserAdmin(getIdToken()) && (
                                      <Link
                                        href="/admin"
                                        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 hover:bg-[var(--nav-bg-active)] text-[var(--nav-text)] bg-blue-500/10 border border-blue-500/30"
                                        onClick={() => setMobileMenuOpen(false)}
                                      >
                                        <Shield className="h-4 w-4 text-blue-400" />
                                        <span className="text-blue-400 font-semibold">Admin</span>
                                      </Link>
                                    )}
                                    <button
                                      onClick={handleSignOut}
                                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 hover:bg-red-500/10 text-red-500 hover:text-red-400"
                                    >
                                      <LogOut className="h-4 w-4" />
                                      Sign Out
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Link
                              href="/auth"
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white text-center"
                            >
                              Sign In
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Separator */}
                    <motion.div
                      variants={itemVariants}
                      initial="closed"
                      animate="open"
                      transition={{ delay: 0.05, duration: 0.2 }}
                      className="my-3 h-px bg-gradient-to-r from-transparent via-border to-transparent"
                    />
                    
                    {/* Navigation Links */}
                    {links.map(({ href, label }, index) => {
                      const isActive = pathname === href
                      return (
                        <motion.div
                          key={href}
                          variants={itemVariants}
                          initial="closed"
                          animate="open"
                          transition={{ delay: (index + 1) * 0.05, duration: 0.2 }}
                        >
                          <Link
                            href={href}
                            className={cn(
                              "flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                              "hover:bg-[var(--nav-bg-active)] hover:text-[var(--nav-text-hover)]",
                              isActive ? "bg-gradient-to-r from-primary/20 to-secondary/20 text-primary font-semibold border border-primary/30" : "text-muted-foreground"
                            )}
                            onClick={() => {
                              setMobileMenuOpen(false)
                              setThemeMenuOpen(false)
                            }}
                          >
                            {label}
                            {isActive && <Sparkles className="ml-auto h-4 w-4" />}
                          </Link>
                        </motion.div>
                      )
                    })}
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
      <Link href="/" className="font-light text-lg sm:text-xl text-foreground mr-6 sm:mr-8">
        ZOCRATIC
      </Link>
      <div className="flex items-center space-x-1">
        {links.map(({ href, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                "hover:text-[var(--nav-text-hover)] rounded-lg",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {label}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg border border-primary/30"
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

      {/* Desktop Auth Section */}
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        {/* Desktop Search Bar - Always Visible - Hidden on fighters pages */}
        {pathname && !pathname.startsWith('/fighters') && (
          <div className="w-80" data-desktop-search-container>
            <FighterSearch 
              onSelectFighter={handleFighterSelect}
              clearSearch={false}
            />
          </div>
        )}
        {!isLoading && (
          <UserMenu isAuthenticated={isAuthenticated} userProfile={userProfile} onSignOut={handleSignOut} isAdmin={isUserAdmin(getIdToken())} />
        )}
      </div>
    </>
  )
} 

// UserMenu component for desktop nav
import { useState, useRef, useEffect } from 'react';

function UserMenu({ isAuthenticated, userProfile, onSignOut, isAdmin }: { isAuthenticated: boolean, userProfile: any, onSignOut: () => void, isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      {isAuthenticated ? (
        <button
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 hover:from-primary/30 hover:to-secondary/30 border border-primary/30 transition-all duration-200"
          onClick={() => setOpen((v) => !v)}
          aria-label="User menu"
        >
          <User className="h-5 w-5 text-primary" />
        </button>
      ) : (
        <Link
          href="/auth"
          className="flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 hover:from-primary/30 hover:to-secondary/30 border border-primary/30 transition-all duration-200 text-sm font-medium text-primary hover:text-primary/80"
        >
          Sign Up
        </Link>
      )}
      {open && isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute right-0 mt-2 w-56 bg-[hsl(var(--background))]/95 backdrop-blur-xl border border-[var(--nav-border)] rounded-xl shadow-xl z-50 py-2"
        >
          {isAuthenticated ? (
            <>
              <div className="px-4 py-3 border-b border-border/50">
                <div className="text-sm font-medium text-[var(--nav-text)] truncate">
                  {userProfile.preferred_username || userProfile.email || 'User'}
                </div>
                <div className="text-xs text-muted-foreground">Member</div>
              </div>
              <a
                href="/dashboard"
                className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--nav-text)] hover:bg-primary/10 hover:text-primary transition-all duration-200 w-full text-left font-medium"
                onClick={() => setOpen(false)}
              >
                <BarChart3 className="h-4 w-4" /> Dashboard
              </a>
              <a
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--nav-text)] hover:bg-primary/10 hover:text-primary transition-all duration-200 w-full text-left font-medium"
                onClick={() => setOpen(false)}
              >
                <SettingsIcon className="h-4 w-4" /> Settings
              </a>
              {isAdmin && (
                <a
                  href="/admin"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all duration-200 w-full text-left font-semibold bg-blue-500/5 border-l-2 border-blue-500"
                  onClick={() => setOpen(false)}
                >
                  <Shield className="h-4 w-4" /> Admin
                </a>
              )}
              <div className="my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <button
                onClick={() => { onSignOut(); setOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 w-full text-left"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <a
                href="/auth"
                className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--nav-text)] hover:bg-primary/10 hover:text-primary transition-all duration-200"
                onClick={() => setOpen(false)}
              >
                <User className="h-4 w-4" /> Sign In
              </a>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
} 