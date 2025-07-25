// API Configuration - force localhost for development
const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '::1'
);

const isDevelopment = process.env.NODE_ENV !== 'production' || isLocalhost;

// Force localhost for development, only use production URL in production builds
export const API_URL = isDevelopment 
  ? 'http://localhost:8000' 
  : (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000');

export const API_PREFIX = '/api/v1';

export const ENDPOINTS = {
  GET_BALANCE: `${API_URL}${API_PREFIX}/predictions-game/balance`,
  PLACE_PICK: `${API_URL}${API_PREFIX}/predictions-game/place-pick`,
  MY_PICKS: `${API_URL}${API_PREFIX}/predictions-game/my-picks`,
  TRANSACTION_HISTORY: `${API_URL}${API_PREFIX}/predictions-game/transaction-history`,
  MY_RANK: `${API_URL}${API_PREFIX}/predictions-game/my-rank`,
  LEADERBOARD: `${API_URL}${API_PREFIX}/predictions-game/leaderboard`,
  UPCOMING_EVENTS: `${API_URL}${API_PREFIX}/upcoming-events`,
  FIGHT_RESULTS: `${API_URL}${API_PREFIX}/fight-results`,
  FIGHT_RESULTS_EVENT: `${API_URL}${API_PREFIX}/fight-results/event`,
}; 