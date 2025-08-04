"use client"

import React, { useState, useEffect } from "react"
import { FighterDetails } from "@/components/fighter-details"
import { PageTransition } from "@/components/page-transition"
import { FighterSearch } from "@/components/fighter-search"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function FighterIdPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fighterId = params?.slug as string;
  
  const handleSelectFighter = () => {
    // Empty function to satisfy the prop requirement
    // This is explicitly defined in the component to avoid the event handler error
  };

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo');
    if (returnTo) {
      const decodedReturnUrl = decodeURIComponent(returnTo);
      sessionStorage.removeItem('fighterPageFrom');
      router.push(decodedReturnUrl);
      return;
    }
    
    const fromPage = sessionStorage.getItem('fighterPageFrom');
    
    if (fromPage && fromPage !== window.location.pathname && !fromPage.startsWith('/fighters/')) {
      sessionStorage.removeItem('fighterPageFrom');
      router.push(fromPage);
      return;
    }
    
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.origin)) {
      const referrerUrl = new URL(referrer);
      const referrerPath = referrerUrl.pathname;
      
      if (referrerPath && referrerPath !== '/' && !referrerPath.startsWith('/fighters/')) {
        sessionStorage.removeItem('fighterPageFrom');
        router.push(referrerPath);
        return;
      }
    }
    
    if (window.history.length > 1) {
      sessionStorage.removeItem('fighterPageFrom');
      router.back();
      return;
    }
    
    sessionStorage.removeItem('fighterPageFrom');
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