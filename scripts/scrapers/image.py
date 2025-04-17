import os
import sys

# Add project root to system path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
    print(f"Added {PROJECT_ROOT} to Python path")

# Import database connection
from backend.api.database import get_supabase_client
"""URGENT: ONLY RUN TO UPDATE IMAGE URLS TO STICKMAN PLACEHOLDER! WILL REPLACE ALL IMAGE URLS WITH STICKMAN PLACEHOLDER"""
# Constants
MAX_WORKERS = 1
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STICKMAN_URL = "https://static1.cbrimages.com/wordpress/wp-content/uploads/2021/01/Captain-Rocks.jpg"

def update_image_urls():
    """
    Updates all fighter image URLs to use the placeholder image.
    Processes fighters in batches to avoid API rate limits.
    """
    try:
        # Initialize database connection
        supabase = get_supabase_client()
        
        # First, get total count
        count_response = supabase.table('fighters').select('count', count='exact').execute()
        total_count = count_response.count
        print(f"[INFO] Total fighters in database: {total_count}")
        
        # Fetch all fighters using proper pagination
        page_size = 1000  # Maximum allowed by Supabase
        all_fighters = []
        page = 0
        
        while len(all_fighters) < total_count:
            # Fetch a page of fighters
            response = supabase.table('fighters') \
                .select('fighter_name') \
                .range(page * page_size, (page + 1) * page_size - 1) \
                .execute()
            
            # Add fighters to our list
            fighters_page = response.data
            if not fighters_page:  # No more results
                break
                
            all_fighters.extend(fighters_page)
            print(f"[INFO] Fetched page {page + 1}: {len(fighters_page)} fighters (Total: {len(all_fighters)}/{total_count})")
            
            # Move to next page
            page += 1
        
        total_fighters = len(all_fighters)
        print(f"[INFO] Successfully fetched all {total_fighters} fighters from the database.")
        
        # Process in smaller batches to avoid rate limits
        batch_size = 50
        success_count = 0
        
        for i in range(0, total_fighters, batch_size):
            batch = all_fighters[i:i+batch_size]
            for fighter in batch:
                fighter_name = fighter['fighter_name']
                try:
                    # Update fighter record
                    response = supabase.table('fighters') \
                        .update({'image_url': STICKMAN_URL}) \
                        .eq('fighter_name', fighter_name) \
                        .execute()
                    
                    if response.data:
                        success_count += 1
                except Exception as e:
                    print(f"[ERROR] Failed to update {fighter_name}: {str(e)}")
            
            print(f"[INFO] Processed {min(i + batch_size, total_fighters)}/{total_fighters} fighters...")
        
        print(f"[DONE] Successfully updated image URLs for {success_count}/{total_fighters} fighters with stickman placeholder")
    except Exception as e:
        print(f"[ERROR] Failed to update image URLs: {str(e)}")

if __name__ == "__main__":
    update_image_urls()