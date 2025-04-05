import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function FighterPage({ params }: PageProps) {
  // Extract the fighter name from the slug
  const resolvedParams = await params;
  const parts = resolvedParams.slug.split('-');
  
  // Find the index where the record starts (pattern: numbers-numbers-numbers)
  const recordIndex = parts.findIndex(part => /^\d+$/.test(part));
  
  // Get just the name parts (everything before the record)
  const nameArray = parts.slice(0, recordIndex);
  const fighterName = nameArray.join(' ').replace(/-/g, ' ').trim();
  
  if (!fighterName) {
    return redirect('/fighters');
  }
  
  // Redirect to the fighters page with the fighter pre-selected
  return redirect(`/fighters?fighter=${encodeURIComponent(fighterName)}`);
} 