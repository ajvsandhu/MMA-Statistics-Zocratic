'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function ScrollbarManager() {
  const pathname = usePathname();

  useEffect(() => {
    const body = document.body;
    const isFighterPage = pathname.startsWith('/fighters') || pathname.startsWith('/fight-predictions');
    
    // Always show scrollbar on fighter pages, hide on others
    if (isFighterPage) {
      body.classList.remove('scrollbar-hidden');
      body.classList.add('scrollbar-visible');
      body.style.overflowY = 'scroll';
      // Ensure padding stays consistent
      body.style.paddingRight = '8px';
      
      // Watch for any changes to padding
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            if (body.style.paddingRight !== '8px') {
              body.style.paddingRight = '8px';
            }
          }
        });
      });

      observer.observe(body, { attributes: true, attributeFilter: ['style'] });

      return () => observer.disconnect();
    } else {
      body.classList.remove('scrollbar-visible');
      body.classList.add('scrollbar-hidden');
      body.style.overflowY = 'hidden';
      body.style.paddingRight = '8px';
    }
  }, [pathname]);

  return null;
} 