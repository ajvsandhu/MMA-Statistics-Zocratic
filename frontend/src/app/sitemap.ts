import { MetadataRoute } from 'next'

async function getAllFighters() {
  try {
    // Try to fetch all fighters from the API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/fighters`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      console.error('Failed to fetch fighters for sitemap')
      return []
    }
    
    const data = await response.json()
    return data.fighters || []
  } catch (error) {
    console.error('Error fetching fighters for sitemap:', error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://zocraticmma.com'
  
  // Get all fighters
  const fighters = await getAllFighters()
  
  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/fighters`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/fight-predictions`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/fight-predictions/events`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/fight-predictions/compare`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    },
  ]
  
  // Fighter profile pages - use fighter IDs
  const fighterPages = fighters.map((fighter: any) => {
    // The fighter data format should be: { name: "Fighter Name (Record) - Weight Class | Ranking", id: "fighter_id" }
    const fighterId = fighter.id // Use the actual fighter ID from the API
    
    return {
      url: `${baseUrl}/fighters/${fighterId}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }
  })
  
  // If we don't get many fighters from the API, generate all possible fighter IDs
  if (fighterPages.length < 100) {
    // Generate fighter IDs from 4468 to 18000 (actual range + future growth)
    for (let i = 4468; i <= 18000; i++) {
      fighterPages.push({
        url: `${baseUrl}/fighters/${i}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })
    }
  }
  
  return [...staticPages, ...fighterPages]
} 