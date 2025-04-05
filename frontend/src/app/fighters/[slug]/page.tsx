import { FighterDetails } from "@/components/fighter-details"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function FighterPage({ params }: PageProps) {
  // Extract the fighter name from the slug
  const resolvedParams = await params;
  const fighterName = resolvedParams.slug.split('-')[0].replace(/-/g, ' ');
  
  return (
    <div className="container mx-auto px-4 py-8">
      <FighterDetails fighterName={fighterName} />
    </div>
  );
} 