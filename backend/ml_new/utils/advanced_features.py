"""
Advanced Feature Engineering for UFC Fight Prediction

This module contains utilities for extracting advanced features from fighter data,
creating comprehensive fighter profiles, and generating matchup-specific features
for more accurate fight predictions. Handles data leakage prevention for training
and adjusts for fighter inactivity.
"""

import pandas as pd
import numpy as np
import re
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, List, Optional, Union
import logging

# Configure logging if not already done elsewhere
# logging.basicConfig(level=logging.INFO) 
logger = logging.getLogger(__name__)

# Utility functions for data parsing and cleaning

def parse_record(record_str: str) -> Tuple[int, int, int]:
    """Parse record string (e.g., '26-6-0', '15-3-0 (1 NC)') into (wins, losses, draws)."""
    try:
        if pd.isna(record_str) or not isinstance(record_str, str): return (0, 0, 0)
        # Remove potential NC info
        record_clean = re.sub(r'\s*\(.*\)', '', record_str).strip()
        parts = record_clean.split('-')
        if len(parts) == 3:
            wins = int(parts[0])
            losses = int(parts[1])
            # Handle cases where draws might not be purely numeric (though less common)
            draws = int(re.search(r'\d+', parts[2]).group()) if re.search(r'\d+', parts[2]) else 0
            return wins, losses, draws
        else: return (0, 0, 0) # Invalid format
    except Exception as e:
        # logger.warning(f"Could not parse record string: '{record_str}'. Error: {e}")
        return (0, 0, 0)


def convert_height_to_inches(height_str: str) -> Optional[float]:
    """Convert height string (e.g., "5' 11"") to total inches."""
    try:
        if pd.isna(height_str) or not isinstance(height_str, str): return None
        feet_inches_match = re.search(r"(\d+)'[\s]*(\d+)[\"\"]?", height_str)
        if feet_inches_match:
            feet = int(feet_inches_match.group(1))
            inches = int(feet_inches_match.group(2))
            return float(feet * 12 + inches)
        inches_match = re.search(r"(\d+(?:\.\d+)?)[\"\"]", height_str)
        if inches_match: return float(inches_match.group(1))
        numeric_match = re.search(r"^(\d+(?:\.\d+)?)$", height_str) # Match only if entire string is numeric
        if numeric_match: return float(numeric_match.group(1))
        return None
    except Exception as e:
        # logger.warning(f"Could not convert height: '{height_str}'. Error: {e}")
        return None


def extract_weight_in_lbs(weight_str: str) -> Optional[float]:
    """Extract weight in pounds (e.g., "185 lbs")."""
    try:
        if pd.isna(weight_str) or not isinstance(weight_str, str): return None
        match = re.search(r"(\d+(?:\.\d+)?)", weight_str)
        if match: return float(match.group(1))
        return None
    except Exception as e:
        # logger.warning(f"Could not extract weight: '{weight_str}'. Error: {e}")
        return None


def extract_reach_in_inches(reach_str: str) -> Optional[float]:
    """Extract reach in inches (e.g., "76"" or "76.0")."""
    try:
        if pd.isna(reach_str) or not isinstance(reach_str, str): return None
        match = re.search(r"(\d+(?:\.\d+)?)", reach_str)
        if match: return float(match.group(1))
        return None
    except Exception as e:
        # logger.warning(f"Could not extract reach: '{reach_str}'. Error: {e}")
        return None


def clean_percentage(pct_str: str) -> Optional[float]:
    """Clean percentage string (e.g., "65%") to float (0.0 to 1.0)."""
    try:
        if pd.isna(pct_str) or not isinstance(pct_str, str): return None
        clean_str = pct_str.replace('%', '').strip()
        value = float(clean_str)
        return value / 100.0
    except Exception as e:
        # logger.warning(f"Could not clean percentage: '{pct_str}'. Error: {e}")
        return None


def extract_landed_attempted(value_str: str) -> Tuple[int, int]:
    """Extract landed/attempted from "X of Y" format."""
    try:
        if pd.isna(value_str) or not isinstance(value_str, str): return (0, 0)
        match = re.search(r'(\d+) of (\d+)', value_str)
        if match: return int(match.group(1)), int(match.group(2))
        # Handle cases with only one number (assume landed, unknown attempted)
        single_num_match = re.search(r'^(\d+)$', value_str)
        if single_num_match: return int(single_num_match.group(1)), 0 
        return (0, 0)
    except Exception as e:
        # logger.warning(f"Could not extract landed/attempted: '{value_str}'. Error: {e}")
        return (0, 0)


def calculate_recency_weight(fight_date: Optional[pd.Timestamp], 
                             context_date: pd.Timestamp,
                             base_weight: float = 1.0, 
                             decay_rate: float = 0.7) -> float:
    """Calculate recency weight relative to a specific context date (e.g., prediction date or another fight date)."""
    if pd.isna(fight_date) or pd.isna(context_date): return 0.1 
    try:
        # Ensure timezone awareness matches or remove timezone info
        if fight_date.tzinfo is not None and context_date.tzinfo is None:
             context_date = context_date.tz_localize(timezone.utc)
        elif fight_date.tzinfo is None and context_date.tzinfo is not None:
             fight_date = fight_date.tz_localize(timezone.utc)
        elif fight_date.tzinfo is not None and context_date.tzinfo is not None and fight_date.tzinfo != context_date.tzinfo:
             # Basic alignment to UTC if different timezones
             fight_date = fight_date.tz_convert(timezone.utc)
             context_date = context_date.tz_convert(timezone.utc)

        days_diff = (context_date - fight_date).days
        if days_diff < 0: return base_weight # Fight is in the future relative to context? Max weight.
        
        years_diff = days_diff / 365.25
        weight = base_weight * (decay_rate ** years_diff)
        return max(0.1, min(base_weight, weight)) 
    except Exception as e:
        # logger.error(f"Error calculating recency weight between {fight_date} and {context_date}: {e}")
        return 0.1 

def calculate_inactivity_penalty(years_inactive: float, 
                                 decay_rate: float = 0.6, # Penalty factor per year inactive
                                 grace_period_years: float = 1.2) -> float:
    """Calculate penalty multiplier (0.05 to 1.0) based on inactivity years.
    
    Now applies penalty only between 1.2 and 2.0 years. 
    No penalty <= 1.2 years or >= 2.0 years.
    """
    if years_inactive <= grace_period_years: 
        return 1.0 # No penalty within grace period
    elif years_inactive >= 2.0:
        return 1.0 # No penalty after 2 years, as requested
    else: # Apply penalty only between 1.2 and 2.0 years
        effective_inactive_years = years_inactive - grace_period_years
        penalty = decay_rate ** effective_inactive_years
        return max(0.05, penalty) # Apply calculated penalty, floor at 0.05

class FighterProfiler:
    """
    Creates comprehensive fighter profiles using data *prior* to a specified date 
    and applies inactivity penalties.
    """
    
    def __init__(self, fighters_df: pd.DataFrame, fights_df: pd.DataFrame):
        self.fighters_df = fighters_df.copy()
        self.fights_df = fights_df.copy()
        self.fights_df['fight_date'] = pd.to_datetime(self.fights_df['fight_date'], errors='coerce')
        # Cache profiles: key is tuple (fighter_name, exclude_fight_date_iso_or_None)
        self.fighter_profiles_cache = {} 

    def get_fighter_profile(self, fighter_name: str, 
                            context_date: Optional[pd.Timestamp] = None) -> Dict[str, Any]:
        """
        Get or build a fighter's profile based on data *before* the context_date.
        If context_date is None, calculates profile based on all available data up to now.
        """
        if context_date is None:
            context_date = pd.Timestamp.now(tz=timezone.utc) # Use current time if no context
        
        # Ensure context_date is timezone-aware (UTC) for consistent comparisons
        if context_date.tzinfo is None:
             context_date = context_date.tz_localize(timezone.utc)
        else:
             context_date = context_date.tz_convert(timezone.utc)
             
        cache_key = (fighter_name, context_date.isoformat() if context_date else None)
        
        if cache_key not in self.fighter_profiles_cache:
            fighter_data_row = self.fighters_df[self.fighters_df['fighter_name'] == fighter_name]
            if not fighter_data_row.empty:
                self.fighter_profiles_cache[cache_key] = self._build_fighter_profile(
                    fighter_data_row.iloc[0], context_date
                )
            else:
                # logger.warning(f"Fighter '{fighter_name}' not found in fighters_df.")
                return {} # Return empty dict if fighter not found
                
        return self.fighter_profiles_cache.get(cache_key, {})

    def _build_fighter_profile(self, fighter_row: pd.Series, 
                               context_date: pd.Timestamp) -> Dict[str, Any]:
        """Build profile using data strictly *before* context_date."""
        fighter_name = fighter_row.get('fighter_name')
        
        # Get all fights for the fighter
        fighter_fights_all_history = self.fights_df[self.fights_df['fighter_name'] == fighter_name].copy()
        
        # Ensure fight_date is timezone-aware (UTC) if not already
        if fighter_fights_all_history['fight_date'].dt.tz is None:
            fighter_fights_all_history['fight_date'] = fighter_fights_all_history['fight_date'].dt.tz_localize(timezone.utc)
        else:
            fighter_fights_all_history['fight_date'] = fighter_fights_all_history['fight_date'].dt.tz_convert(timezone.utc)
        
        # Ensure context_date is also timezone-aware (UTC)
        if context_date.tzinfo is None:
            context_date_aware = context_date.tz_localize(timezone.utc)
        else:
            context_date_aware = context_date.tz_convert(timezone.utc)
            
        # Filter relevant fights (strictly before context_date)
        relevant_fights = fighter_fights_all_history[fighter_fights_all_history['fight_date'] < context_date_aware].copy()
        relevant_fights = relevant_fights.sort_values('fight_date', ascending=False)
        
        # 1. Extract basic profile & calculate inactivity relative to context_date
        basic_profile = self._extract_basic_profile(fighter_row, relevant_fights, context_date_aware)
        inactivity_penalty = calculate_inactivity_penalty(basic_profile.get('years_since_last_fight', 10.0)) 
        
        # 2. Analyze fight history (using relevant fights & penalty)
        fight_analysis = self._analyze_fight_history(relevant_fights, inactivity_penalty, context_date_aware)
        
        # 3. Analyze striking (using static stats penalized by inactivity, and relevant fights for rates)
        striking_analysis = self._analyze_striking_tendencies(fighter_row, relevant_fights, inactivity_penalty)
        
        # 4. Analyze grappling (using static stats penalized by inactivity, and relevant fights for rates)
        grappling_analysis = self._analyze_grappling_tendencies(fighter_row, relevant_fights, inactivity_penalty)
        
        # 5. Analyze defense vulnerabilities (using relevant fights)
        vulnerability_analysis = self._analyze_defensive_vulnerabilities(relevant_fights)
        
        # 6. Analyze opposition quality (using relevant fights & penalty)
        opposition_analysis = self._analyze_opposition_quality(fighter_name, relevant_fights, inactivity_penalty, context_date_aware)
        
        # Combine
        profile = {
            **basic_profile, **fight_analysis, **striking_analysis, 
            **grappling_analysis, **vulnerability_analysis, **opposition_analysis,
            'inactivity_penalty_factor': inactivity_penalty 
        }
        
        # Clean final profile
        cleaned_profile = {}
        for k, v in profile.items():
             if isinstance(v, (int, float, np.number)) and (pd.isna(v) or np.isinf(v)):
                 cleaned_profile[k] = 0.0
             else:
                 cleaned_profile[k] = v
                 
        return cleaned_profile

    def _extract_basic_profile(self, fighter_row: pd.Series, relevant_fights: pd.DataFrame, context_date: pd.Timestamp) -> Dict[str, Any]:
        """Extract basic info & calculate inactivity relative to context_date."""
        # --- Record, Physicals (as before) ---
        wins, losses, draws = parse_record(fighter_row.get('Record', '0-0-0'))
        total_fights_rec = wins + losses + draws
        win_pct_rec = wins / total_fights_rec if total_fights_rec > 0 else 0.0
        
        height = convert_height_to_inches(fighter_row.get('Height'))
        weight = extract_weight_in_lbs(fighter_row.get('Weight'))
        reach = extract_reach_in_inches(fighter_row.get('Reach'))

        profile = {
            'fighter_name': fighter_row.get('fighter_name'),
            'wins_record': wins, 'losses_record': losses, 'draws_record': draws,
            'total_fights_record': total_fights_rec, 'win_pct_record': win_pct_rec,
            'height': height or 0.0, 'weight': weight or 0.0, 'reach': reach or 0.0,
            'stance': fighter_row.get('STANCE', 'Orthodox'),
        }

        # --- Calculate Inactivity relative to context_date ---
        last_fight_date = relevant_fights['fight_date'].max() # Max date *before* context_date
        years_inactive = 10.0 # Default high inactivity
        if pd.notna(last_fight_date):
            # Ensure timezone aware comparison
            if last_fight_date.tzinfo is None: last_fight_date = last_fight_date.tz_localize(timezone.utc)
            years_inactive = (context_date - last_fight_date).days / 365.25

        profile['years_since_last_fight'] = years_inactive

        # --- UFC Stats (as before) ---
        ufc_stats_map = {'SLpM': 'slpm', 'Str. Acc.': 'str_acc', 'SApM': 'sapm', 'Str. Def': 'str_def', 'TD Avg.': 'td_avg', 'TD Acc.': 'td_acc', 'TD Def.': 'td_def', 'Sub. Avg.': 'sub_avg'}
        for src, dest in ufc_stats_map.items():
            val = fighter_row.get(src); processed_val = 0.0
            if pd.notna(val):
                 if '%' in str(val): 
                     processed_val = clean_percentage(val) or 0.0
                 else: 
                     try: 
                         processed_val = float(val)
                     except (ValueError, TypeError): 
                         pass # Keep processed_val as 0.0 if conversion fails
            profile[dest] = processed_val
            
        # --- Ranking (as before, but use rank_score primarily) ---
        profile['rank_score'] = 0.4; profile['is_champion'] = 0
        rank_val = fighter_row.get('ranking'); is_champ_flag = fighter_row.get('is_champion')
        if is_champ_flag: profile['rank_score'] = 1.0; profile['is_champion'] = 1
        elif pd.notna(rank_val):
            try:
                rank_str = str(rank_val); rank_num = 999
                if 'C' in rank_str.upper(): rank_num = 0
                else: rank_match = re.search(r'#?(\d+)', rank_str); rank_num = int(rank_match.group(1)) if rank_match else 999
                if rank_num == 0: profile['rank_score'] = 1.0; profile['is_champion'] = 1
                elif rank_num <= 5: profile['rank_score'] = 1.0 - (rank_num - 1) * 0.04
                elif rank_num <= 10: profile['rank_score'] = 0.8 - (rank_num - 6) * 0.04
                elif rank_num <= 15: profile['rank_score'] = 0.6 - (rank_num - 11) * 0.04
            except: pass
            
        return profile

    def _analyze_fight_history(self, relevant_fights: pd.DataFrame, inactivity_penalty: float, context_date: pd.Timestamp) -> Dict[str, Any]:
        """Analyze history using relevant fights, apply inactivity penalty, use context_date for recency."""
        num_relevant = len(relevant_fights)
        recent_fights = relevant_fights.head(5)
        num_recent = len(recent_fights)

        defaults = { 'recent_fights_analyzed': num_recent, 'total_fights_analyzed': num_relevant, 'finish_rate': 0.0, 'ko_win_rate': 0.0, 'sub_win_rate': 0.0, 'decision_win_rate': 0.0, 'ko_loss_rate': 0.0, 'sub_loss_rate': 0.0, 'decision_loss_rate': 0.0, 'weighted_win_rate': 0.0, 'recent_performance_score': 0.0, 'avg_fight_time_mins': 7.5}
        if num_recent == 0: return defaults

        wins = recent_fights[recent_fights['result'] == 'W']; losses = recent_fights[recent_fights['result'] == 'L']
        ko_wins = wins[wins['method'].str.contains('KO|TKO', na=False)]; sub_wins = wins[wins['method'].str.contains('Sub', na=False)]; dec_wins = wins[~(wins['method'].str.contains('KO|TKO|Sub', na=False))]
        ko_losses = losses[losses['method'].str.contains('KO|TKO', na=False)]; sub_losses = losses[losses['method'].str.contains('Sub', na=False)]; dec_losses = losses[~(losses['method'].str.contains('KO|TKO|Sub', na=False))]

        analysis = {
            'recent_fights_analyzed': num_recent, 'total_fights_analyzed': num_relevant,
            'finish_rate': (len(ko_wins) + len(sub_wins)) / num_recent * inactivity_penalty,
            'ko_win_rate': len(ko_wins) / num_recent * inactivity_penalty,
            'sub_win_rate': len(sub_wins) / num_recent * inactivity_penalty,
            'decision_win_rate': len(dec_wins) / num_recent * inactivity_penalty,
            'ko_loss_rate': len(ko_losses) / num_recent, 'sub_loss_rate': len(sub_losses) / num_recent, 'decision_loss_rate': len(dec_losses) / num_recent,
        }

        weighted_sum, weight_sum = 0.0, 0.0
        for _, fight in recent_fights.iterrows():
            rec_weight = calculate_recency_weight(fight['fight_date'], context_date=context_date)
            res_val = 1 if fight['result'] == 'W' else 0
            weighted_sum += res_val * rec_weight; weight_sum += rec_weight
        
        analysis['weighted_win_rate'] = (weighted_sum / weight_sum) * inactivity_penalty if weight_sum > 0 else 0.0
        analysis['recent_performance_score'] = weighted_sum * inactivity_penalty 

        # Avg fight time calculation (as before)
        durations = []
        if 'round' in recent_fights.columns and 'time' in recent_fights.columns:
             rounds = pd.to_numeric(recent_fights['round'], errors='coerce')
             times = recent_fights['time'].fillna('5:00')
             for r, t in zip(rounds, times):
                  if pd.notna(r):
                       try: m, s = map(int, t.split(':')); dur = (r - 1) * 5 + (m + s / 60.0); durations.append(dur)
                       except: pass
        analysis['avg_fight_time_mins'] = np.mean(durations) if durations else 7.5
        
        return analysis

    def _analyze_striking_tendencies(self, fighter_row: pd.Series, relevant_fights: pd.DataFrame, inactivity_penalty: float) -> Dict[str, Any]:
        """Analyze striking stats, applying inactivity penalty to rate stats."""
        striking = { 'slpm': fighter_row.get('slpm', 0.0) * inactivity_penalty, 'str_acc': fighter_row.get('str_acc', 0.0), 'sapm': fighter_row.get('sapm', 0.0), 'str_def': fighter_row.get('str_def', 0.0)}
        
        defaults = { 'knockdown_rate': 0.0, 'knockdown_efficiency': 0.0, 'head_strike_pct': 0.33, 'body_strike_pct': 0.33, 'leg_strike_pct': 0.33, 'sig_str_landed_per_fight': 0.0, 'sig_str_attempted_per_fight': 0.0, 'striking_style': 'unknown'}
        num_fights = len(relevant_fights)
        if num_fights == 0: striking.update(defaults); return striking

        kd_total = pd.to_numeric(relevant_fights['kd'], errors='coerce').fillna(0).sum()
        
        # Directly calculate totals
        head_l, head_a = 0, 0
        body_l, body_a = 0, 0
        leg_l, leg_a = 0, 0
        sig_l, sig_a = 0, 0

        if 'head_str' in relevant_fights.columns:
            for val in relevant_fights['head_str']: l, a = extract_landed_attempted(val); head_l += l; head_a += a
        if 'body_str' in relevant_fights.columns:
            for val in relevant_fights['body_str']: l, a = extract_landed_attempted(val); body_l += l; body_a += a
        if 'leg_str' in relevant_fights.columns:
            for val in relevant_fights['leg_str']: l, a = extract_landed_attempted(val); leg_l += l; leg_a += a
        if 'sig_str' in relevant_fights.columns:
             for val in relevant_fights['sig_str']: l, a = extract_landed_attempted(val); sig_l += l; sig_a += a
        
        total_landed = sig_l if sig_l > 0 else head_l + body_l + leg_l
        total_attempted = sig_a if sig_a > 0 else head_a + body_a + leg_a

        striking.update({
            'knockdown_rate': (kd_total / num_fights) * inactivity_penalty,
            'head_strike_pct': head_l / total_landed if total_landed > 0 else 0.33,
            'body_strike_pct': body_l / total_landed if total_landed > 0 else 0.33,
            'leg_strike_pct': leg_l / total_landed if total_landed > 0 else 0.33,
            'knockdown_efficiency': kd_total / total_landed if total_landed > 0 else 0.0,
            'sig_str_landed_per_fight': (sig_l / num_fights) * inactivity_penalty,
            'sig_str_attempted_per_fight': (sig_a / num_fights) * inactivity_penalty,
        })

        # Style classification (use penalized volume)
        vol = striking['slpm']; acc = striking['str_acc']; kd = striking['knockdown_rate']; leg = striking['leg_strike_pct']
        if vol > 4.5 and acc > 0.45: style = 'high-volume-accurate'
        elif vol > 4.5: style = 'high-volume'
        elif kd > 0.5: style = 'power-puncher'
        elif acc > 0.5: style = 'precise'
        elif leg > 0.4: style = 'leg-kicker'
        else: style = 'balanced'
        striking['striking_style'] = style
        
        return striking

    def _analyze_grappling_tendencies(self, fighter_row: pd.Series, relevant_fights: pd.DataFrame, inactivity_penalty: float) -> Dict[str, Any]:
        """Analyze grappling stats, applying inactivity penalty to rate stats."""
        # Use penalized static stats from basic profile
        grappling = {'td_avg': fighter_row.get('td_avg', 0.0) * inactivity_penalty, 'td_acc': fighter_row.get('td_acc', 0.0), 'td_def': fighter_row.get('td_def', 0.0), 'sub_avg': fighter_row.get('sub_avg', 0.0) * inactivity_penalty}
        
        defaults = {'td_landed_per_fight': 0.0, 'td_attempted_per_fight': 0.0, 'control_time_per_fight': 0.0, 'sub_attempts_per_fight': 0.0, 'grappling_style': 'unknown'}
        num_fights = len(relevant_fights)
        if num_fights == 0: grappling.update(defaults); return grappling

        # Calculate rates from relevant fights
        td_l, td_a, ctrl_tot, sub_att = 0, 0, 0.0, 0
        if 'takedowns' in relevant_fights.columns:
             for val in relevant_fights['takedowns']: l, a = extract_landed_attempted(val); td_l += l; td_a += a
        if 'ctrl' in relevant_fights.columns:
             for val in relevant_fights['ctrl']:
                  if pd.notna(val) and isinstance(val, str) and ':' in val:
                       try: m, s = map(int, val.split(':')); ctrl_tot += m + s / 60.0
                       except: pass
        if 'sub_att' in relevant_fights.columns: sub_att = pd.to_numeric(relevant_fights['sub_att'], errors='coerce').fillna(0).sum()

        grappling.update({
            'td_landed_per_fight': (td_l / num_fights) * inactivity_penalty,
            'td_attempted_per_fight': (td_a / num_fights) * inactivity_penalty,
            'control_time_per_fight': (ctrl_tot / num_fights) * inactivity_penalty,
            'sub_attempts_per_fight': (sub_att / num_fights) * inactivity_penalty,
        })

        # Style classification (use penalized averages)
        td_avg = grappling['td_avg']; sub_avg = grappling['sub_avg']; td_def = grappling['td_def']
        if td_avg < 1.0 and sub_avg > 1.0: style = 'guard-player'
        elif td_avg > 3.0 and sub_avg < 1.0: style = 'ground-and-pound'
        elif td_avg > 2.0 and sub_avg > 1.0: style = 'submission-wrestler'
        elif td_def > 0.8 and td_avg < 1.0: style = 'defensive'
        elif td_def < 0.5: style = 'takedown-vulnerable'
        else: style = 'balanced'
        grappling['grappling_style'] = style

        return grappling

    def _analyze_defensive_vulnerabilities(self, relevant_fights: pd.DataFrame) -> Dict[str, Any]:
         """Analyze defensive vulnerabilities based on relevant fights."""
         vuln = {'ko_vulnerability': 0.0, 'sub_vulnerability': 0.0, 'cardio_issues': 0.0}
         num_fights = len(relevant_fights)
         if num_fights < 3: return vuln # Require minimum fights for vulnerability assessment

         losses = relevant_fights[relevant_fights['result'] == 'L']
         num_losses = len(losses)
         if num_losses == 0: return vuln 

         ko_losses = losses[losses['method'].str.contains('KO|TKO', na=False)]
         sub_losses = losses[losses['method'].str.contains('Sub', na=False)]
         
         # Base vulnerability on proportion of *losses*
         vuln['ko_vulnerability'] = len(ko_losses) / num_losses
         vuln['sub_vulnerability'] = len(sub_losses) / num_losses

         # Cardio based on late losses as proportion of *all relevant fights*
         if 'round' in relevant_fights.columns:
              rounds = pd.to_numeric(losses['round'], errors='coerce')
              late_losses = losses[rounds > 2]
              # Scale by 1.5, max 1.0
              vuln['cardio_issues'] = min(1.0, (len(late_losses) / num_fights) * 1.5) 
              
         return vuln

    def _analyze_opposition_quality(self, fighter_name: str, relevant_fights: pd.DataFrame, inactivity_penalty: float, context_date: pd.Timestamp) -> Dict[str, Any]:
        """Analyze opposition quality based on relevant fights, applying inactivity penalty."""
        defaults = {'opponent_quality_score': 0.5 * inactivity_penalty, 'elite_wins': 0, 'avg_quality_of_losses': 0.0}
        num_fights = len(relevant_fights)
        if num_fights == 0: return defaults

        opp_quality_sum, opp_recency_sum, elite_wins, loss_qual_sum, loss_recency_sum = 0.0, 0.0, 0, 0.0, 0.0
        
        unique_opponents = relevant_fights['opponent'].dropna().unique()
        opponent_scores = {}
        for opp_name in unique_opponents:
            opp_data = self.fighters_df[self.fighters_df['fighter_name'] == opp_name]
            if not opp_data.empty:
                 opponent_scores[opp_name] = self._calculate_opponent_quality_score(opp_data.iloc[0])

        for _, fight in relevant_fights.iterrows():
             opp_name = fight['opponent']; fight_date = fight['fight_date']; result = fight['result']
             if pd.isna(opp_name): continue
             
             opp_quality = opponent_scores.get(opp_name, 0.4) # Lower default if opp not found
             recency_weight = calculate_recency_weight(fight_date, context_date=context_date)
             weighted_quality = opp_quality * recency_weight
             
             opp_quality_sum += weighted_quality
             opp_recency_sum += recency_weight
             
             if result == 'W' and opp_quality > 0.75: elite_wins += 1
             if result == 'L':
                 loss_qual_sum += weighted_quality
                 loss_recency_sum += recency_weight

        avg_opp_quality = (opp_quality_sum / opp_recency_sum) * inactivity_penalty if opp_recency_sum > 0 else 0.0
        avg_loss_quality = (loss_qual_sum / loss_recency_sum) if loss_recency_sum > 0 else 0.0 # Don't penalize loss quality

        return {
            'opponent_quality_score': avg_opp_quality,
            'elite_wins': elite_wins,
            'avg_quality_of_losses': avg_loss_quality,
        }

    def _calculate_opponent_quality_score(self, opponent_row: pd.Series) -> float:
        """Calculate opponent quality score based on their static record and rank."""
        # (Implementation mostly as before)
        wins, losses, draws = parse_record(opponent_row.get('Record', '0-0-0'))
        total_fights = wins + losses + draws
        win_pct = wins / total_fights if total_fights > 0 else 0.0
        experience_factor = min(1.0, total_fights / 25.0)
        rank_score = 0.4; is_champ = opponent_row.get('is_champion', False)
        if is_champ: rank_score = 1.0
        else:
            rank_val = opponent_row.get('ranking')
            if pd.notna(rank_val):
                 try:
                     rank_str = str(rank_val); rank_num = 999
                     if 'C' in rank_str.upper(): rank_num = 0
                     else: rank_match = re.search(r'#?(\d+)', rank_str); rank_num = int(rank_match.group(1)) if rank_match else 999
                     if rank_num == 0: rank_score = 1.0
                     elif rank_num <= 5: rank_score = 1.0 - (rank_num - 1) * 0.04
                     elif rank_num <= 10: rank_score = 0.8 - (rank_num - 6) * 0.04
                     elif rank_num <= 15: rank_score = 0.6 - (rank_num - 11) * 0.04
                 except: pass
        # Weighted combination
        quality = (0.5 * rank_score) + (0.3 * win_pct) + (0.2 * experience_factor)
        return min(1.0, quality)

class MatchupAnalyzer:
    """Analyzes matchups using FighterProfiler, handles context date for feature generation."""
    
    def __init__(self, profiler: FighterProfiler, fights_df: pd.DataFrame):
        self.profiler = profiler
        self.fights_df = fights_df.copy() # Keep original for H2H/common opp
        self.fights_df['fight_date'] = pd.to_datetime(self.fights_df['fight_date'], errors='coerce')
        if self.fights_df['fight_date'].dt.tz is None:
            self.fights_df['fight_date'] = self.fights_df['fight_date'].dt.tz_localize(timezone.utc)
        else:
            self.fights_df['fight_date'] = self.fights_df['fight_date'].dt.tz_convert(timezone.utc)


    def get_matchup_features(self, fighter1_name: str, fighter2_name: str, 
                             context_date: Optional[pd.Timestamp] = None) -> Dict[str, Any]:
        """Generate comparative features based on profiles calculated relative to context_date."""
        
        # Get profiles relative to context_date
        fighter1_profile = self.profiler.get_fighter_profile(fighter1_name, context_date)
        fighter2_profile = self.profiler.get_fighter_profile(fighter2_name, context_date)
        
        if not fighter1_profile or not fighter2_profile: return {}
        
        features = {}
        features.update(self._calculate_physical_advantage(fighter1_profile, fighter2_profile))
        features.update(self._calculate_experience_advantage(fighter1_profile, fighter2_profile))
        features.update(self._analyze_striking_matchup(fighter1_profile, fighter2_profile))
        features.update(self._analyze_grappling_matchup(fighter1_profile, fighter2_profile))
        features.update(self._analyze_competition_quality(fighter1_profile, fighter2_profile))
        features['inactivity_advantage'] = fighter2_profile.get('years_since_last_fight', 10) - fighter1_profile.get('years_since_last_fight', 10) 
        
        # History analysis uses fights strictly *before* context_date
        features.update(self._analyze_history(fighter1_name, fighter2_name, context_date))
        
        return features

    # --- Advantage calculation methods (mostly same, use adjusted profile values) ---
    def _calculate_physical_advantage(self, f1: Dict, f2: Dict) -> Dict: 
        return {
            'height_advantage': f1.get('height', 0) - f2.get('height', 0),
            'reach_advantage': f1.get('reach', 0) - f2.get('reach', 0),
            'weight_advantage': f1.get('weight', 0) - f2.get('weight', 0)
        }
    def _calculate_experience_advantage(self, f1: Dict, f2: Dict) -> Dict: return {'total_fights_advantage': f1.get('total_fights_analyzed', 0) - f2.get('total_fights_analyzed', 0), 'win_pct_record_advantage': f1.get('win_pct_record', 0) - f2.get('win_pct_record', 0), 'weighted_win_rate_advantage': f1.get('weighted_win_rate', 0) - f2.get('weighted_win_rate', 0)}
    def _analyze_striking_matchup(self, f1: Dict, f2: Dict) -> Dict: 
         f1_ko = f1.get('ko_win_rate', 0) * (1 + f1.get('knockdown_rate', 0)); f2_ko = f2.get('ko_win_rate', 0) * (1 + f2.get('knockdown_rate', 0))
         return {'slpm_advantage': f1.get('slpm', 0) - f2.get('slpm', 0), 'str_acc_advantage': f1.get('str_acc', 0) - f2.get('str_acc', 0), 'str_def_advantage': f1.get('str_def', 0) - f2.get('str_def', 0), 'sapm_advantage': f2.get('sapm', 0) - f1.get('sapm', 0), 'ko_potential_advantage': (f1_ko * f2.get('ko_vulnerability', 0)) - (f2_ko * f1.get('ko_vulnerability', 0))}
    def _analyze_grappling_matchup(self, f1: Dict, f2: Dict) -> Dict: 
        f1_sub = f1.get('sub_win_rate', 0) * (1 + f1.get('sub_avg', 0)); f2_sub = f2.get('sub_win_rate', 0) * (1 + f2.get('sub_avg', 0))
        return {'td_avg_advantage': f1.get('td_avg', 0) - f2.get('td_avg', 0), 'td_acc_advantage': f1.get('td_acc', 0) - f2.get('td_acc', 0), 'td_def_advantage': f1.get('td_def', 0) - f2.get('td_def', 0), 'sub_avg_advantage': f1.get('sub_avg', 0) - f2.get('sub_avg', 0), 'sub_potential_advantage': (f1_sub * f2.get('sub_vulnerability', 0)) - (f2_sub * f1.get('sub_vulnerability', 0)), 'control_time_advantage': f1.get('control_time_per_fight', 0) - f2.get('control_time_per_fight', 0)}
    def _analyze_competition_quality(self, f1: Dict, f2: Dict) -> Dict: return {'opponent_quality_advantage': f1.get('opponent_quality_score', 0.5) - f2.get('opponent_quality_score', 0.5), 'elite_wins_advantage': f1.get('elite_wins', 0) - f2.get('elite_wins', 0), 'avg_loss_quality_advantage': f1.get('avg_quality_of_losses', 0.0) - f2.get('avg_quality_of_losses', 0.0)} # Advantage if your losses were against better opps

    def _analyze_history(self, fighter1_name: str, fighter2_name: str, 
                         context_date: Optional[pd.Timestamp] = None) -> Dict:
        """Analyze H2H and common opponents based on fights strictly *before* context_date."""
        history = {'fought_before': 0, 'h2h_record_advantage': 0, 'common_opponent_advantage': 0, 'common_opponent_count': 0}
        
        # Filter fights DB based on context_date
        if context_date is None: context_date = pd.Timestamp.now(tz=timezone.utc)
        elif context_date.tzinfo is None: context_date = context_date.tz_localize(timezone.utc)
        else: context_date = context_date.tz_convert(timezone.utc)
            
        relevant_fights_df = self.fights_df[self.fights_df['fight_date'] < context_date].copy()
        
        # Head-to-Head
        f1_fights_hist = relevant_fights_df[relevant_fights_df['fighter_name'] == fighter1_name]
        h2h_fights = f1_fights_hist[f1_fights_hist['opponent'] == fighter2_name]
        if not h2h_fights.empty:
            history['fought_before'] = 1
            f1_wins = len(h2h_fights[h2h_fights['result'] == 'W'])
            history['h2h_record_advantage'] = f1_wins - (len(h2h_fights) - f1_wins)

        # Common Opponents
        f2_fights_hist = relevant_fights_df[relevant_fights_df['fighter_name'] == fighter2_name]
        f1_opps = set(f1_fights_hist['opponent'].dropna())
        f2_opps = set(f2_fights_hist['opponent'].dropna())
        common_opps = f1_opps.intersection(f2_opps)
        
        if common_opps:
             history['common_opponent_count'] = len(common_opps)
             common_adv = 0
             for opp in common_opps:
                 # Get most recent result against common opp *before* context date
                 f1_vs = f1_fights_hist[f1_fights_hist['opponent'] == opp].sort_values('fight_date', ascending=False)
                 f2_vs = f2_fights_hist[f2_fights_hist['opponent'] == opp].sort_values('fight_date', ascending=False)
                 if not f1_vs.empty and not f2_vs.empty:
                     f1_res = f1_vs.iloc[0]['result']; f2_res = f2_vs.iloc[0]['result']
                     if f1_res == 'W' and f2_res == 'L': common_adv += 1
                     elif f1_res == 'L' and f2_res == 'W': common_adv -= 1
             history['common_opponent_advantage'] = common_adv
             
        return history

    def get_prediction_features(self, fighter1_name: str, fighter2_name: str, 
                                context_date: Optional[pd.Timestamp] = None) -> Dict[str, Any]:
        """Generate final feature set, using profiles generated relative to context_date."""
        
        fighter1_profile = self.profiler.get_fighter_profile(fighter1_name, context_date)
        fighter2_profile = self.profiler.get_fighter_profile(fighter2_name, context_date)
        
        if not fighter1_profile or not fighter2_profile: 
            # logger.warning(f"Could not get profiles for prediction: {fighter1_name} vs {fighter2_name} (context: {context_date})")
            return {}
            
        matchup_features = self.get_matchup_features(fighter1_name, fighter2_name, context_date)
        if not matchup_features: 
            # logger.warning(f"Could not get matchup features for prediction: {fighter1_name} vs {fighter2_name} (context: {context_date})")
            return {}

        features = {}
        exclude_cols = ['fighter_name', 'stance', 'striking_style', 'grappling_style'] # Non-numeric or redundant
        
        for key, value in fighter1_profile.items():
            if key not in exclude_cols and isinstance(value, (int, float, np.number)) and not isinstance(value, bool):
                features[f'f1_{key}'] = value
        for key, value in fighter2_profile.items():
             if key not in exclude_cols and isinstance(value, (int, float, np.number)) and not isinstance(value, bool):
                 features[f'f2_{key}'] = value
        
        features.update(matchup_features)
            
        # Final cleaning
        final_features = {}
        for key, value in features.items():
            final_features[key] = 0.0 if pd.isna(value) or np.isinf(value) else float(value)
                
        return final_features 