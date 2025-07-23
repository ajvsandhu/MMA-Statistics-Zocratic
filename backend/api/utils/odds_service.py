"""
Odds API Service Module

This module provides functionality to interact with The Odds API
to fetch betting odds for UFC/MMA events and integrate them with
the existing event scraping system.
"""

import os
import requests
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class OddsService:
    """Service class for interacting with The Odds API"""
    
    def __init__(self):
        self.api_key = os.getenv('ODDS_KEY')
        self.base_url = "https://api.the-odds-api.com/v4"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        if not self.api_key:
            logger.error("ODDS_KEY not found in environment variables")
            raise ValueError("ODDS_KEY is required")
    
    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """Make a request to the odds API with error handling and rate limiting"""
        if params is None:
            params = {}
        
        params['apiKey'] = self.api_key
        
        try:
            logger.info(f"Making request to {endpoint} with params: {params}")
            response = requests.get(f"{self.base_url}{endpoint}", params=params, headers=self.headers)
            
            # Log rate limiting headers
            if 'x-requests-remaining' in response.headers:
                logger.info(f"API requests remaining: {response.headers.get('x-requests-remaining')}")
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:  # Rate limit exceeded
                logger.warning("Rate limit exceeded")
                return None
            else:
                logger.error(f"API request failed with status {response.status_code}: {response.text}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Request failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error making request to {endpoint}: {str(e)}")
            return None
    
    def get_available_sports(self) -> List[Dict]:
        """Get list of all available sports from the API"""
        logger.info("Fetching available sports from Odds API")
        
        response = self._make_request('/sports')
        if response:
            sports = response if isinstance(response, list) else response.get('data', [])
            logger.info(f"Found {len(sports)} sports available from API")
            return sports
        return []
    
    def get_mma_sport_key(self) -> Optional[str]:
        """Get the sport key for MMA/UFC"""
        sports = self.get_available_sports()
        
        for sport in sports:
            if sport.get('group') == 'Mixed Martial Arts' or sport.get('key') == 'mma_mixed_martial_arts':
                logger.info(f"Found MMA sport: {sport}")
                return sport.get('key')
        
        logger.warning("MMA sport not found in available sports")
        return None
    
    def get_mma_odds(self, regions: List[str] = None, markets: List[str] = None) -> List[Dict]:
        """Get odds for MMA/UFC events"""
        if regions is None:
            regions = ['us', 'uk', 'eu', 'au']  # Get odds from multiple regions
        if markets is None:
            markets = ['h2h']  # Head-to-head (moneyline) by default
        
        sport_key = self.get_mma_sport_key()
        if not sport_key:
            logger.error("Could not find MMA sport key")
            return []
        
        params = {
            'regions': ','.join(regions),
            'markets': ','.join(markets),
            'oddsFormat': 'american',
            'dateFormat': 'iso'
        }
        
        logger.info(f"Fetching MMA odds from API for sport: {sport_key}")
        response = self._make_request(f'/sports/{sport_key}/odds', params)
        
        if response:
            odds = response if isinstance(response, list) else response.get('data', [])
            logger.info(f"Found {len(odds)} MMA events with odds from API")
            return odds
        return []
    
    def get_event_odds(self, event_id: str, regions: List[str] = None, markets: List[str] = None) -> Optional[Dict]:
        """Get odds for a specific event"""
        if regions is None:
            regions = ['us', 'uk', 'eu', 'au']
        if markets is None:
            markets = ['h2h']
        
        sport_key = self.get_mma_sport_key()
        if not sport_key:
            logger.error("Could not find MMA sport key")
            return None
        
        params = {
            'regions': ','.join(regions),
            'markets': ','.join(markets),
            'oddsFormat': 'american',
            'dateFormat': 'iso'
        }
        
        logger.info(f"Fetching odds for event: {event_id}")
        response = self._make_request(f'/sports/{sport_key}/events/{event_id}/odds', params)
        
        if response:
            return response.get('data') if isinstance(response, dict) else response
        return None
    
    def match_fighters_to_odds(self, matchups: List[Dict], odds_events: List[Dict]) -> List[Dict]:
        """Match fighters to odds events and enrich matchups with betting odds"""
        if not odds_events:
            logger.warning("No odds events to match")
            return matchups
        
        logger.info(f"Matching {len(matchups)} matchups to {len(odds_events)} odds events")
        
        matched_count = 0
        
        for matchup in matchups:
            # Fix: Use the correct field names from scraper
            fighter1_name = matchup.get('fighter1_name', '').lower()
            fighter2_name = matchup.get('fighter2_name', '').lower()
            
            # Try to find matching odds event
            matching_event = None
            best_match_score = 0
            
            # Check each odds event for the best match
            for event in odds_events:
                home_team = event.get('home_team', '').lower()
                away_team = event.get('away_team', '').lower()
                
                # Calculate match score for this event
                match_score = 0
                
                # Check if both fighters can be found in this event
                fighter1_in_home = self._names_similar(fighter1_name, home_team)
                fighter1_in_away = self._names_similar(fighter1_name, away_team)
                fighter2_in_home = self._names_similar(fighter2_name, home_team)
                fighter2_in_away = self._names_similar(fighter2_name, away_team)
                
                # Both fighters must be found in the event (one as home, one as away)
                if (fighter1_in_home and fighter2_in_away) or (fighter1_in_away and fighter2_in_home):
                    # Perfect match - both fighters found in correct positions
                    match_score = 10
                elif (fighter1_in_home or fighter1_in_away) and (fighter2_in_home or fighter2_in_away):
                    # Both fighters found but may be in same position (shouldn't happen)
                    match_score = 5
                elif fighter1_in_home or fighter1_in_away or fighter2_in_home or fighter2_in_away:
                    # Only one fighter found - partial match (not good enough)
                    match_score = 1
                
                # Select the best matching event
                if match_score > best_match_score:
                    best_match_score = match_score
                    matching_event = event
            
            # Only accept matches where both fighters are found (score >= 5)
            if matching_event and best_match_score >= 5:
                # Process the odds for this matchup
                odds_data = self._process_odds_data(matching_event)
                
                # Map the odds to the correct fighters
                mapped_odds = self._map_odds_to_fighters(matchup, odds_data)
                
                matchup['odds_data'] = mapped_odds
                matchup['odds_event_id'] = matching_event.get('id')
                matched_count += 1
                
                logger.info(f"Matched {fighter1_name} vs {fighter2_name} with odds event (score: {best_match_score})")
            else:
                matchup['odds_data'] = None
                matchup['odds_event_id'] = None
                logger.warning(f"No odds found for {fighter1_name} vs {fighter2_name} (best score: {best_match_score})")
        
        logger.info(f"Successfully matched {matched_count}/{len(matchups)} matchups with odds")
        return matchups
    
    def _names_similar(self, name1: str, name2: str, threshold: float = 0.8) -> bool:
        """Check if two names are similar enough to be considered a match"""
        if not name1 or not name2:
            return False
        
        # Normalize names
        name1 = name1.lower().strip()
        name2 = name2.lower().strip()
        
        # Direct match
        if name1 == name2:
            return True
        
        # Check if one name contains the other
        if name1 in name2 or name2 in name1:
            return True
        
        # Check last names
        name1_parts = name1.split()
        name2_parts = name2.split()
        
        if len(name1_parts) > 1 and len(name2_parts) > 1:
            if name1_parts[-1] == name2_parts[-1]:  # Same last name
                return True
        
        # Use edit distance for spelling variations (like almabayev vs almabaev)
        similarity = self._calculate_name_similarity(name1, name2)
        return similarity >= threshold
    
    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """Calculate similarity between two names using edit distance"""
        if not name1 or not name2:
            return 0.0
        
        # Simple edit distance calculation
        def edit_distance(s1, s2):
            if len(s1) < len(s2):
                return edit_distance(s2, s1)
            
            if len(s2) == 0:
                return len(s1)
            
            previous_row = range(len(s2) + 1)
            for i, c1 in enumerate(s1):
                current_row = [i + 1]
                for j, c2 in enumerate(s2):
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row
            
            return previous_row[-1]
        
        max_len = max(len(name1), len(name2))
        if max_len == 0:
            return 1.0
        
        distance = edit_distance(name1, name2)
        similarity = 1.0 - (distance / max_len)
        return similarity
    
    def _process_odds_data(self, event: Dict) -> Dict:
        """Process raw odds data from API into structured format"""
        if not event:
            return {}
        
        home_team = event.get('home_team', '')
        away_team = event.get('away_team', '')
        bookmakers = event.get('bookmakers', [])
        
        if not bookmakers:
            return {
                'home_team': home_team,
                'away_team': away_team,
                'best_odds': None,
                'draftkings_odds': None,
                'fanduel_odds': None,
                'odds_count': 0,
                'last_update': None,
                'event_id': event.get('id'),
                'sport_title': event.get('sport_title'),
                'commence_time': event.get('commence_time')
            }
        
        best_home_odds = None
        best_away_odds = None
        draftkings_odds = None
        fanduel_odds = None
        
        for bookmaker in bookmakers:
            bookmaker_key = bookmaker.get('key', '').lower()
            bookmaker_title = bookmaker.get('title', '').lower()
            
            markets = bookmaker.get('markets', [])
            for market in markets:
                if market.get('key') == 'h2h':  # Head-to-head (moneyline)
                    outcomes = market.get('outcomes', [])
                    
                    for outcome in outcomes:
                        team = outcome.get('name', '')
                        odds = outcome.get('price', 0)
                        
                        # Convert positive odds to american format for consistency
                        if odds > 0:
                            american_odds = odds
                        else:
                            american_odds = odds
                        
                        # Check for DraftKings
                        if bookmaker_key == 'draftkings' or 'draftkings' in bookmaker_title:
                            if not draftkings_odds:
                                draftkings_odds = {}
                            if team == home_team:
                                draftkings_odds['home_team'] = american_odds
                            elif team == away_team:
                                draftkings_odds['away_team'] = american_odds
                        
                        # Check for FanDuel
                        elif bookmaker_key == 'fanduel' or 'fanduel' in bookmaker_title:
                            if not fanduel_odds:
                                fanduel_odds = {}
                            if team == home_team:
                                fanduel_odds['home_team'] = american_odds
                            elif team == away_team:
                                fanduel_odds['away_team'] = american_odds
                        
                        # Track best odds
                        if team == home_team:
                            if best_home_odds is None or american_odds > best_home_odds:
                                best_home_odds = american_odds
                        elif team == away_team:
                            if best_away_odds is None or american_odds > best_away_odds:
                                best_away_odds = american_odds
        
        # Determine which odds to use (prioritize DraftKings > FanDuel > Best)
        if draftkings_odds and draftkings_odds.get('home_team') and draftkings_odds.get('away_team'):
            primary_odds = draftkings_odds
        elif fanduel_odds and fanduel_odds.get('home_team') and fanduel_odds.get('away_team'):
            primary_odds = fanduel_odds
        else:
            primary_odds = {
                'home_team': best_home_odds,
                'away_team': best_away_odds
            }
        
        return {
            'home_team': home_team,
            'away_team': away_team,
            'best_odds': {
                'home_team': best_home_odds,
                'away_team': best_away_odds
            },
            'draftkings_odds': draftkings_odds,
            'fanduel_odds': fanduel_odds,
            'primary_odds': primary_odds,
            'odds_count': len(bookmakers),
            'last_update': event.get('last_update'),
            'event_id': event.get('id'),
            'sport_title': event.get('sport_title'),
            'commence_time': event.get('commence_time')
        }
    
    def _map_odds_to_fighters(self, matchup: Dict, odds_data: Dict) -> Dict:
        """Map odds data to specific fighters in the matchup"""
        if not odds_data or not matchup:
            return {}
        
        # Fix: Use the correct field names from scraper
        fighter1_name = matchup.get('fighter1_name', '').lower()
        fighter2_name = matchup.get('fighter2_name', '').lower()
        
        home_team = odds_data.get('home_team', '').lower()
        away_team = odds_data.get('away_team', '').lower()
        
        # Determine which fighter maps to which team
        fighter1_is_home = self._names_similar(fighter1_name, home_team)
        fighter2_is_home = self._names_similar(fighter2_name, home_team)
        
        # Get the primary odds (DraftKings > FanDuel > Best)
        primary_odds = odds_data.get('primary_odds', {})
        draftkings_odds = odds_data.get('draftkings_odds')
        fanduel_odds = odds_data.get('fanduel_odds')
        
        # Determine bookmaker being used
        using_draftkings = bool(draftkings_odds and draftkings_odds.get('home_team') and draftkings_odds.get('away_team'))
        using_fanduel = bool(not using_draftkings and fanduel_odds and fanduel_odds.get('home_team') and fanduel_odds.get('away_team'))
        
        # Map odds to fighters
        if fighter1_is_home:
            fighter1_odds = primary_odds.get('home_team')
            fighter2_odds = primary_odds.get('away_team')
        elif fighter2_is_home:
            fighter1_odds = primary_odds.get('away_team')
            fighter2_odds = primary_odds.get('home_team')
        else:
            # If we can't determine mapping, use best guess
            fighter1_odds = primary_odds.get('home_team')
            fighter2_odds = primary_odds.get('away_team')
        
        return {
            'fighter1_odds': {
                'odds': fighter1_odds,
                'bookmaker': 'DraftKings' if using_draftkings else 'FanDuel' if using_fanduel else 'Best Available'
            },
            'fighter2_odds': {
                'odds': fighter2_odds,
                'bookmaker': 'DraftKings' if using_draftkings else 'FanDuel' if using_fanduel else 'Best Available'
            },
            'using_draftkings': using_draftkings,
            'using_fanduel': using_fanduel,
            'preferred_bookmaker': 'DraftKings' if using_draftkings else 'FanDuel' if using_fanduel else 'Best Available',
            'odds_count': odds_data.get('odds_count', 0),
            'last_update': odds_data.get('last_update'),
            'event_id': odds_data.get('event_id')
        }
    
    def get_odds_summary(self, odds_data: Dict) -> Dict:
        """Get a summary of odds data for display"""
        if not odds_data:
            return {}
        
        using_draftkings = odds_data.get('using_draftkings', False)
        using_fanduel = odds_data.get('using_fanduel', False)
        
        summary = {
            'home_team': odds_data.get('home_team'),
            'away_team': odds_data.get('away_team'),
            'best_home_odds': odds_data.get('best_odds', {}).get('home_team'),
            'best_away_odds': odds_data.get('best_odds', {}).get('away_team'),
            'fighter1_odds': odds_data.get('fighter1_odds'),
            'fighter2_odds': odds_data.get('fighter2_odds'),
            'bookmaker_count': odds_data.get('odds_count', 0),
            'last_update': odds_data.get('last_update'),
            'using_draftkings': using_draftkings,
            'using_fanduel': using_fanduel and not using_draftkings,  # Only true if FanDuel is used (not DraftKings)
            'preferred_bookmaker': 'DraftKings' if using_draftkings else 'FanDuel' if using_fanduel else 'Best Available',
            'event_id': odds_data.get('event_id')
        }
        
        return summary

# Utility function to get odds service instance
def get_odds_service() -> Optional[OddsService]:
    """Get a configured odds service instance"""
    try:
        return OddsService()
    except Exception as e:
        logger.error(f"Failed to create odds service: {str(e)}")
        return None 