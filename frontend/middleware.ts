import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Let's grab the current URL for later use
  const url = request.nextUrl.clone()
  const path = url.pathname
  
  // Set up our response by forwarding the initial request
  const response = NextResponse.next()
  
  // Add some security headers - keeps the bad guys out
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Remember which fighters the user was viewing recently
  // This helps us personalize their experience next time
  if (path.includes('/fighter/') || path.includes('/fighters/')) {
    const visitorId = request.cookies.get('visitor-id')?.value || crypto.randomUUID()
    
    // Store this for 30 days
    response.cookies.set('visitor-id', visitorId, { 
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    })
    
    // If they're looking at a specific fighter, remember that
    if (path.includes('/fighter/')) {
      const fighterId = path.split('/').pop()
      if (fighterId) {
        const recentFighters = request.cookies.get('recent-fighters')?.value
        let fighters = recentFighters ? JSON.parse(recentFighters) : []
        
        // Add this fighter to their recent list if not already there
        if (!fighters.includes(fighterId)) {
          fighters = [fighterId, ...fighters].slice(0, 5) // Keep last 5
          response.cookies.set('recent-fighters', JSON.stringify(fighters), {
            maxAge: 60 * 60 * 24 * 7, // Week-long memory
            path: '/'
          })
        }
      }
    }
  }
  
  // Make fight predictions always fresh - no stale data
  if (path.includes('/fight-predictions')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0')
  }
  
  // Add some lightweight analytics
  const referer = request.headers.get('referer') || 'direct'
  response.headers.set('X-Page-Visited', path)
  response.headers.set('X-Referrer-Path', referer)
  
  // Let's go!
  return response
}

// Only run this middleware where it makes sense
export const config = {
  matcher: [
    // Skip the boring static stuff
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 