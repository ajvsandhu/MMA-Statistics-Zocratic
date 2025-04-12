"use client"

import { useState, useEffect } from "react"
import { FighterDetails } from "@/components/fighter-details"
import { PageTransition } from "@/components/page-transition"
import { FighterSearch } from "@/components/fighter-search"
import { parseFighterSlug } from "@/lib/utils"
import { useParams } from "next/navigation"

export default function FighterSlugPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [fighterName, setFighterName] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    
    // Parse the slug to get fighter name and record
    const { name, record } = parseFighterSlug(slug);
    
    // Combine name and record into the full fighter name format expected by the components
    const fullFighterName = record ? `${name} ${record}` : name;
    
    setFighterName(fullFighterName);
  }, [slug]);
  
  const handleSelectFighter = () => {
    // Empty function to satisfy the prop requirement
    // This is explicitly defined in the component to avoid the event handler error
  };
  
  if (!fighterName) {
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
          <div className="sticky top-24 z-50 max-w-2xl mx-auto w-full mb-16">
            <FighterSearch 
              onSelectFighter={handleSelectFighter} 
              clearSearch={true}
            />
          </div>
          
          <FighterDetails fighterName={fighterName} />
        </div>
      </div>
    </PageTransition>
  );
} 