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
  USER_PICKS: `${API_URL}${API_PREFIX}/predictions-game/user-picks`,
  TRANSACTION_HISTORY: `${API_URL}${API_PREFIX}/predictions-game/transaction-history`,
  MY_RANK: `${API_URL}${API_PREFIX}/predictions-game/my-rank`,
  LEADERBOARD: `${API_URL}${API_PREFIX}/predictions-game/leaderboard`,
  UPCOMING_EVENTS: `${API_URL}${API_PREFIX}/upcoming-events`,
  FIGHT_RESULTS: `${API_URL}${API_PREFIX}/fight-results`,
  FIGHT_RESULTS_EVENT: `${API_URL}${API_PREFIX}/fight-results/event`,
  FIGHTERS_SEARCH: `${API_URL}${API_PREFIX}/fighters`,
  FIGHTER_DETAILS: `${API_URL}${API_PREFIX}/fighter`,
  FIGHTERS_COUNT: `${API_URL}${API_PREFIX}/fighters-count`,
  ZOBOT_CHAT: `${API_URL}${API_PREFIX}/zobot/chat`,
  ZOBOT_STATUS: `${API_URL}${API_PREFIX}/zobot/status`,
  PREDICTION: `${API_URL}${API_PREFIX}/prediction/predict`,
  CHECK_USERNAME: `${API_URL}${API_PREFIX}/auth/check-username`,
};

// Utility function for API calls with retries
export const fetchWithRetries = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}; 