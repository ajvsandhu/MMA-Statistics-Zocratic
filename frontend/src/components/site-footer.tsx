import Link from "next/link"
import Image from "next/image"

export function SiteFooter() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="mt-auto bg-card/10 backdrop-blur-sm border-t border-border/30">
      <div className="py-4 px-4">
        {/* Disclaimer: unobtrusive, centered, very small and muted, now above main content */}
        <div className="mb-3 text-center text-[10px] text-muted-foreground/70 leading-tight select-none">
          Zocratic MMA does not own or commercialize any data, images, or content used on this site. All content is for informational and educational purposes only.
        </div>
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-2 min-h-0">
        {/* Logo and name, smaller and less bold */}
        <div className="flex items-center flex-1 justify-start min-w-0">
          <Link href="/" className="font-semibold text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Image src="/favicon.ico" alt="Zocratic Logo" width={20} height={20} className="rounded-sm opacity-80" />
            ZOCRATIC
          </Link>
        </div>
        {/* Center: Policy Links, smaller and lighter */}
        <div className="flex-1 flex justify-center space-x-4 text-[11px] text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
            Terms & Conditions
          </Link>
        </div>
        {/* Right: Credits, smaller and lighter */}
        <div className="flex-1 flex justify-end text-[11px] text-muted-foreground text-right min-w-0">
          <span className="flex items-center gap-1 truncate">
            Made by
            <span className="font-normal underline ml-1"><a href="https://www.linkedin.com/in/shariq-khan-430754217/" target="_blank" rel="noopener noreferrer">Shariq</a></span>
            <span>&amp;</span>
            <span className="font-normal underline"><a href="https://www.linkedin.com/in/ajayveer-sandhu-7897a72a7/" target="_blank" rel="noopener noreferrer">Ajayveer</a></span>
          </span>
        </div>
        </div>
      </div>
    </footer>
  )
} 