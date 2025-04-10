"use client"

import { use } from "react"
import { FighterDetails } from "@/components/fighter-details"
import { PageTransition, AnimatedContainer } from "@/components/page-transition"
import { FighterSearch } from "@/components/fighter-search"

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function FighterPage({ params }: PageProps) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  
  // Extract the fighter name from the slug
  const parts = slug.split('-');
  
  // Find where the record starts (pattern: numbers-numbers-numbers)
  // We look for three consecutive parts that are all numbers
  let recordIndex = -1;
  for (let i = 0; i < parts.length - 2; i++) {
    if (/^\d+$/.test(parts[i]) && /^\d+$/.test(parts[i+1]) && /^\d+$/.test(parts[i+2])) {
      recordIndex = i;
      break;
    }
  }
  
  // Default to the original logic if the pattern isn't found
  if (recordIndex === -1) {
    recordIndex = parts.findIndex(part => /^\d+$/.test(part));
  }
  
  // Get just the name parts (everything before the record)
  const nameArray = recordIndex > 0 ? parts.slice(0, recordIndex) : parts;
  const fighterName = nameArray.join(' ').replace(/-/g, ' ').trim();
  
  // Get the record if it exists
  const recordParts = recordIndex > -1 ? parts.slice(recordIndex) : [];
  const record = recordParts.length === 3 ? `(${recordParts.join('-')})` : '';
  
  // The full name with record that the component expects
  const fullFighterName = record ? `${fighterName} ${record}` : fighterName;
  
  console.log('Fighter page rendering with:', { slug, fighterName, record, fullFighterName });
  
  if (!fighterName) {
    return <div>Fighter not found</div>;
  }
  
  return (
    <PageTransition variant="fade">
      <div className="container relative mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="sticky top-24 z-50 max-w-2xl mx-auto w-full mb-16">
            <FighterSearch 
              onSelectFighter={() => {}}
              clearSearch={true}
            />
          </div>
          
          <AnimatedContainer delay={0.2} className="max-w-4xl mx-auto">
            <FighterDetails fighterName={fullFighterName} />
          </AnimatedContainer>
        </div>
      </div>
    </PageTransition>
  );
} 