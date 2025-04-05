import { FighterDetails } from "@/components/fighter-details"
import { notFound } from "next/navigation"

interface PageProps {
  params: {
    slug: string;
  };
}

export default function FighterPage({ params }: PageProps) {
  // Extract the fighter name from the slug
  const fighterName = params.slug.split('-')[0].replace(/-/g, ' ');
  
  return (
    <div className="container mx-auto px-4 py-8">
      <FighterDetails fighterName={fighterName} />
    </div>
  );
} 