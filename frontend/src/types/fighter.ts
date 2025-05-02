/**
 * Represents a fighter's statistics and profile information
 */
export interface FighterStats {
  id?: string;
  name: string;
  fighter_name?: string;
  record: string;
  image_url: string;
  height: string;
  weight: string;
  reach: string;
  stance: string;
  dob: string;
  slpm: string;
  str_acc: string;
  sapm: string;
  str_def: string;
  td_avg: string;
  td_acc: string;
  td_def: string;
  sub_avg: string;
  nickname?: string;
  weight_class?: string;
  last_5_fights?: FightHistory[];
  ranking: string | number;
  tap_link?: string;
}

/**
 * Represents a single fight in a fighter's history
 */
export interface FightHistory {
  id: string | number;
  fighter_name?: string;
  fighter_id?: string;
  fight_url: string;
  kd: string;
  sig_str: string;
  sig_str_pct: string;
  total_str: string;
  head_str: string;
  body_str: string;
  leg_str: string;
  takedowns: string;
  td_pct: string;
  ctrl: string;
  result: string;
  method: string;
  opponent: string;
  fight_date: string;
  event: string;
  round: number;
  time: string;
  opponent_name?: string;
  opponent_display_name?: string;
  date?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Represents a prediction result between two fighters
 */
export interface Prediction {
  winner: string;
  loser: string;
  winner_probability: number;
  loser_probability: number;
  prediction_confidence: number;
  model_version: string;
  head_to_head: {
    fighter1_wins: number;
    fighter2_wins: number;
    last_winner?: string;
    last_method?: string;
  };
  fighter1: FighterPredictionData;
  fighter2: FighterPredictionData;
}

/**
 * Represents prediction data for a single fighter
 */
export interface FighterPredictionData {
  name: string;
  record: string;
  image_url: string;
  probability: number;
  win_probability?: string;
} 