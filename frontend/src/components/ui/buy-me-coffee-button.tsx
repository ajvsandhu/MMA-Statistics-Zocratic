"use client"

import { useEffect, useRef } from 'react'

export function BuyMeCoffeeButton() {
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buttonRef.current || typeof window === 'undefined') return
    
    // Remove any existing button first
    while (buttonRef.current.firstChild) {
      buttonRef.current.removeChild(buttonRef.current.firstChild)
    }

    // Create the button directly as the BMC docs suggest
    const bmcBtn = document.createElement('a')
    bmcBtn.className = 'bmc-button'
    bmcBtn.target = '_blank'
    bmcBtn.href = 'https://www.buymeacoffee.com/00khanshar7'
    bmcBtn.innerHTML = '<img src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" alt="Buy Me A Coffee" style="height: 40px !important; width: 142px !important;" />'
    buttonRef.current.appendChild(bmcBtn)
  }, [])

  return <div ref={buttonRef} className="inline-flex items-center" />
} 