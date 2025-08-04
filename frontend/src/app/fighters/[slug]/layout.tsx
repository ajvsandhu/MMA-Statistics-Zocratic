import { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: fighterId } = await params
  
  // Try to get fighter data for better metadata
  let fighterName = "UFC Fighter"
  let fighterDescription = "View detailed statistics, fight history, and performance metrics for this UFC fighter."
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/fighter-stats/${fighterId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (response.ok) {
      const fighterData = await response.json()
      if (fighterData.fighter_name) {
        fighterName = fighterData.fighter_name
        fighterDescription = `View detailed statistics, fight history, and performance metrics for ${fighterName}. Get comprehensive UFC fighter analysis and predictions on Zocratic MMA.`
      }
    }
  } catch (error) {
    // Fallback to generic metadata if API call fails
  }
  
  return {
    title: `${fighterName} - Fighter Profile | Zocratic MMA`,
    description: fighterDescription,
    openGraph: {
      title: `${fighterName} - Fighter Profile`,
      description: fighterDescription,
      type: "profile",
      url: `https://zocraticmma.com/fighters/${fighterId}`,
      siteName: "Zocratic MMA",
      locale: "en_US",
      images: [{
        url: "https://zocraticmma.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${fighterName} - UFC Fighter Profile`
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${fighterName} - Fighter Profile`,
      description: fighterDescription,
      images: ["https://zocraticmma.com/og-image.jpg"],
    },
    alternates: {
      canonical: `https://zocraticmma.com/fighters/${fighterId}`,
    },
    other: {
      // Add structured data for fighter profiles
      'application/ld+json': JSON.stringify([
        {
          "@context": "https://schema.org",
          "@type": "Person",
          "name": fighterName,
          "description": `UFC fighter ${fighterName} - View detailed statistics, fight history, and performance metrics`,
          "url": `https://zocraticmma.com/fighters/${fighterId}`,
          "image": "https://zocraticmma.com/og-image.jpg",
          "jobTitle": "UFC Fighter",
          "worksFor": {
            "@type": "Organization",
            "name": "UFC"
          },
          "sameAs": [
            `https://zocraticmma.com/fighters/${fighterId}`
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://zocraticmma.com"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Fighters",
              "item": "https://zocraticmma.com/fighters"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": fighterName,
              "item": `https://zocraticmma.com/fighters/${fighterId}`
            }
          ]
        }
      ])
    }
  }
}

export default function FighterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 