"use client"

import React, { useState, useEffect } from "react"
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
  
  // Get the stored "from" page when component mounts
  React.useEffect(() => {
    // If we don't have a stored from page, try to get it from the referrer
    const fromPage = sessionStorage.getItem('fighterPageFrom');
    if (!fromPage) {
      const referrer = document.referrer;
      if (referrer && referrer.includes(window.location.origin)) {
        const referrerUrl = new URL(referrer);
        const referrerPath = referrerUrl.pathname;
        if (referrerPath && referrerPath !== '/' && !referrerPath.startsWith('/fighters/')) {
          sessionStorage.setItem('fighterPageFrom', referrerPath);
        }
      }
    }
  }, []);
  
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
      return;
    }
    
    // Get the stored "from" page
    const fromPage = sessionStorage.getItem('fighterPageFrom');
    
    // If we have a stored from page and it's not the current page, go back there
    if (fromPage && fromPage !== window.location.pathname && !fromPage.startsWith('/fighters/')) {
      router.push(fromPage);
      return;
    }
    
    // Fallback to referrer logic
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.origin)) {
      const referrerUrl = new URL(referrer);
      const referrerPath = referrerUrl.pathname;
      
      // If we came from a valid page within our app, go back there
      if (referrerPath && referrerPath !== '/' && !referrerPath.startsWith('/fighters/')) {
        router.push(referrerPath);
        return;
      }
    }
    
    // Default fallback - go to home page
    router.push('/');
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