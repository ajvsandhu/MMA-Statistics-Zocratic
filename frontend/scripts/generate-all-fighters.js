const fs = require('fs');
const path = require('path');

async function generateAllFightersSitemap() {
  try {
    const baseUrl = 'https://zocraticmma.com';
    const currentDate = new Date().toISOString();
    
    // Generate fighter IDs starting from 4468 (your actual range)
    // Let's go up to 18000 to cover current and future fighters
    const allFighterIds = [];
    for (let i = 4468; i <= 18000; i++) {
      allFighterIds.push(i.toString());
    }
    
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
    
    // Add ALL fighter pages (current and future)
    allFighterIds.forEach((fighterId) => {
      sitemap += `
  <url>
    <loc>${baseUrl}/fighters/${fighterId}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });
    
    sitemap += `
</urlset>`;
    
    // Write to public directory
    const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemap);
    
    console.log(`✅ Sitemap generated with ${allFighterIds.length} fighter pages!`);
    console.log(`📊 Fighter ID range: 4468-18000 (${allFighterIds.length} total)`);
    console.log(`📊 Total URLs: ${allFighterIds.length + 8}`);
    console.log(`🔗 Sitemap saved to: ${sitemapPath}`);
    console.log(`🚀 Ready to submit to Google Search Console!`);
    console.log(`📈 Future-ready: Will automatically include new fighters as they're added!`);
    
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
  }
}

generateAllFightersSitemap(); 