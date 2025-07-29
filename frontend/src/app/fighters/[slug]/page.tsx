"use client"

import { useState, useEffect } from "react"
import { FighterDetails } from "@/components/fighter-details"
import { PageTransition } from "@/components/page-transition"
import { FighterSearch } from "@/components/fighter-search"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function FighterIdPage() {
  const params = useParams();
  const router = useRouter();
  const fighterId = params?.slug as string; // The route parameter is still called slug but contains the ID
  
  const handleSelectFighter = () => {
    // Empty function to satisfy the prop requirement
    // This is explicitly defined in the component to avoid the event handler error
  };

  const handleBack = () => {
    // Check if there's a returnTo query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('returnTo');
    
    if (returnTo) {
      // Decode and navigate to the specified return URL
      const decodedReturnUrl = decodeURIComponent(returnTo);
      router.push(decodedReturnUrl);
    } else {
      // Check if we have saved compare page state - if so, go back to compare page
      const savedState = sessionStorage.getItem('comparePageState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          const now = Date.now();
          const stateAge = now - state.timestamp;
          
          // If we have recent compare state, go back to compare page
          if (stateAge < 30 * 60 * 1000 && (state.fighter1 || state.fighter2)) {
            router.push('/fight-predictions/compare');
            return;
          }
        } catch (error) {
          console.error('Error checking compare state:', error);
        }
      }
      
      // Fall back to referrer logic
      const referrer = document.referrer;
      
      // Check if we came from within our app (same origin)
      if (referrer && referrer.includes(window.location.origin)) {
        // Extract the path from the referrer
        const referrerUrl = new URL(referrer);
        const referrerPath = referrerUrl.pathname;
        
        // If we came from another fighter page, go back to the main pages
        if (referrerPath.startsWith('/fighters/')) {
          // Go to a main page instead of another fighter page
          router.push('/fight-predictions');
        } else {
          // Go back to the original referrer
          router.push(referrerPath);
        }
      } else {
        // If no referrer or external referrer, go to predictions page as default
        router.push('/fight-predictions');
      }
    }
  };
  
  if (!fighterId) {
    return (
      <div className="container relative mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  return (
    <PageTransition variant="fade">
      <div className="container relative mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <div className="sticky top-24 z-10 max-w-2xl mx-auto w-full mb-16">
            <FighterSearch 
              onSelectFighter={handleSelectFighter} 
              clearSearch={true}
            />
          </div>
          
          <FighterDetails fighterId={fighterId} />
        </div>
      </div>
    </PageTransition>
  );
} 