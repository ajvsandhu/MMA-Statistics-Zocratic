# Changelog

## Version 1.00 - Initial Release
- UFC fighter database with detailed statistics
- Fighter search functionality with name-based lookup
- Fighter details page showing comprehensive stats and fight history
- Fight predictions page with AI-powered win probability analysis
- Fighter comparison tool with visual stat comparisons
- Responsive design with modern UI/UX
- Real-time data updates from UFC Stats

## Version 1.01 - UI and Search Improvement
- Enhanced ranking display format (Champion, #1-#15)
- Improved fighter search with better partial name matching
- Optimized search performance with caching
- New filter search option
- Updated fighter card design with cleaner ranking badges
-UI/UX overhaul, quality of life changes 

## Version 1.02 - Code Optimization and Cleanup
- Removed unused components and files for better maintainability
- Consolidated utility functions into a single file
- Improved code organization and type safety
- Enhanced scrollbar management across different pages
- Optimized component imports and dependencies
- Streamlined fighter data handling and validation 

## Version 1.03 - Search and Compare Page Improvements
- Fixed fighter search suggestions to properly show 5 recent searches
- Implemented independent search histories for fighter comparison page
- Optimized search bar functionality and history management
- Fixed animation issues in fighter comparison page
- Improved fighter card rendering and state management
- Enhanced search history persistence across page navigation
- Fixed ranking and stats display animations
- Optimized component re-rendering for better performance
- Added proper error handling for search history
- Improved search history synchronization between components

## Version 1.04 - Advanced ML Pipeline Implementation
- Replaced the existing machine learning pipeline (`ml`) with a new, advanced system (`ml_new`).
- Implemented sophisticated feature engineering (`advanced_features.py`):
  - Time-weighted fight recency and fighter inactivity penalties.
  - Comprehensive `FighterProfiler` generating detailed historical performance profiles.
  - `MatchupAnalyzer` creating comparative features based on striking, grappling, physicals, experience, competition quality, H2H, and common opponents.
- Enhanced data loading (`DataLoader`) to fetch directly from Supabase, removing potential CSV dependencies.
- Updated training (`train.py`) and prediction logic (`predict.py`, API endpoint) to utilize the new pipeline, improving prediction accuracy and reliability.
- Refactored application (`main.py`) to integrate the new ML components during startup.
- Removed legacy `ml` module dependencies from the core application.

## Version 1.05 - Upcoming Events Analysis and UI Improvements
- Added new upcoming event scraper to fetch and analyze upcoming UFC events
- Created dedicated event analysis page showing fighter card comparisons
- Improved mobile display with responsive layouts for all screen sizes
- Enhanced page loading experience with smooth transitions and animations
- Fixed image sizing and display issues on mobile devices
- Implemented multi-line text handling for fighter names
- Optimized data fetching and storage to frontend public directory
- Added support for cronjob automation for scrapers on server deployment
- Fixed dependency issues in scrapers by updating requirements.txt
- Improved error handling and loading states throughout the application
