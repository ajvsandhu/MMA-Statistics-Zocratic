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

## Version 1.06 - Zobot AI Assistant Integration
- **Major Feature**: Introduced Zobot AI, an intelligent MMA chat assistant powered by Groq's LLM (llama-3.1-8b-instant)
- **Real-time Data Integration**: Zobot has access to complete fighter database with 4,305+ fighters and real-time statistics
- **ML Prediction Integration**: Seamlessly integrates with the advanced leakproof prediction model for accurate fight analysis
- **Intelligent Fighter Recognition**: Advanced name matching system with extensive fighter nickname mappings (40+ common names)
- **Multiple Analysis Contexts**: 
  - Fighter vs Fighter comparisons with detailed breakdowns and ML predictions
  - Individual fighter statistics and career analysis
  - Statistical analysis with sample size and fighting style context
  - Martial arts technique instruction with safety guidelines
- **Smart Response System**: Dynamic token allocation based on request complexity (600-1200 tokens)
- **Modern Chat Interface**: Real-time chat with proper message formatting, session management, and status indicators
- **Error Handling**: Comprehensive error handling with graceful degradation and user-friendly messages
- **Navigation Integration**: Added Zobot AI to main navigation menu
- **Safety Features**: Built-in safety protocols for technique instruction and educational context
- **Statistical Accuracy**: Context-aware statistical analysis that considers fighter styles and sample sizes
- **API Infrastructure**: Complete REST API with `/chat` and `/status` endpoints for reliable service management

## Version 1.07 - Odds System Fix and Predictions Display
- **Fighter Odds Mapping Fix**: Resolved critical bug where betting odds were incorrectly mapped to fighters, ensuring accurate odds display for favorites vs underdogs
- **Predictions Display Fix**: Fixed issue where ML predictions weren't displaying correctly on the frontend
- **Intelligent Odds Prioritization**: Enhanced odds display system to prioritize preferred odds providers with automatic fallback to best available odds
- **Frontend Data Fetching Optimization**: Simplified data fetching to use single endpoint for both predictions and odds
- **Fighter Name Matching**: Fixed data structure mismatch in odds mapping where scraper provided direct field names but service expected nested objects
- **API Integration**: Enhanced odds service with robust error handling and direct API calls
- **Data Flow Simplification**: Removed dual endpoint fetching that was causing data conflicts in frontend
- **Security Enhancement**: Reduced HTTP request logging to prevent database URL exposure
- **Odds Service Module**: Fixed `match_fighters_to_odds` function to properly handle fighter name mapping
- **Fighter Mapping Logic**: Corrected algorithm to map odds regardless of API ordering using direct field access
- **Cache System Removal**: Completely removed caching system for simplified, direct API architecture
- **Database Cleanup**: Removed odds cache table and related infrastructure
- **Odds Display Component**: Enhanced visual indicators for different odds providers with color-coded styling
- **Predictions Display**: Fixed ML predictions showing correctly with proper percentage formatting
- **Data Fetching**: Simplified to single endpoint call preventing data conflicts
- **Debug Logging**: Added comprehensive logging for troubleshooting future issues
- **Direct API Integration**: Removed caching parameters for cleaner, direct API calls
- **Improved Logging**: Enhanced monitoring with detailed operation logs
- **Real-time Data**: All odds and predictions now fetch fresh data directly from APIs
- **Error Handling**: Better handling of API failures and missing data
- **Accuracy**: Fixed odds mapping ensures correct favorite/underdog display
- **Reliability**: Simplified architecture reduces potential points of failure
- **Real-time Updates**: Direct API calls ensure most current odds and predictions
- **Maintainability**: Cleaner codebase without complex caching logic
- **Security**: Reduced HTTP logging to prevent sensitive URL exposure
- **Documentation**: Updated system documentation to reflect simplified architecture
- **Testing**: Verified all odds matching and predictions display correctly
- **Modular Architecture**: Clean separation of concerns for easier maintenance
- **Odds Mapping Bug**: Fixed data structure mismatch causing incorrect fighter-to-odds mapping
- **Predictions Not Displaying**: Resolved frontend data fetching conflicts
- **Generic Odds Display**: Fixed system showing generic -215/+185 instead of real market odds
- **Security Logging**: Prevented database URL exposure in production logs 