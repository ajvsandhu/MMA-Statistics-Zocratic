const fs = require('fs');
const path = require('path');

async function generateSitemap() {
  try {
    // Fetch all fighters from the API
    const response = await fetch('http://localhost:8000/api/v1/fighters', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch fighters');
      return;
    }
    
    const data = await response.json();
    const fighters = data.fighters || [];
    
    const baseUrl = 'https://zocraticmma.com';
    const currentDate = new Date().toISOString();
    
    // Start building the sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Main Pages -->
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/fighters</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/fight-predictions</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/fight-predictions/events</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/fight-predictions/compare</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy-policy</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms-of-service</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>`;
    
             // Add fighter pages from API
    fighters.forEach((fighter) => {
      const fighterId = fighter.id; // Use the actual fighter ID
      sitemap += `
  <url>
    <loc>${baseUrl}/fighters/${fighterId}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });
    
    // Add known popular fighter IDs for better coverage
    const popularFighterIds = [
      '7249', // Khabib
      '7248', // Conor McGregor
      '7247', // Israel Adesanya
      '7246', // Jon Jones
      '7245', // Kamaru Usman
      '7244', // Alexander Volkanovski
      '7243', // Charles Oliveira
      '7242', // Dustin Poirier
      '7241', // Max Holloway
      '7240', // Robert Whittaker
      // Add more popular fighter IDs as needed
    ];
    
    popularFighterIds.forEach(id => {
      sitemap += `
  <url>
    <loc>${baseUrl}/fighters/${id}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });
    
    sitemap += `
</urlset>`;
    
    // Write to public directory
    const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemap);
    
    console.log(`Sitemap generated with ${fighters.length} fighter pages from API`);
    console.log(`Added ${popularFighterIds.length} popular fighter IDs`);
    console.log(`Total URLs: ${fighters.length + popularFighterIds.length + 8}`);
    
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

generateSitemap(); 