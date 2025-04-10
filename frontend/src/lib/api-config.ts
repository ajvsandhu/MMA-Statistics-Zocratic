// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
export const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1'

// API request timeout and retry configuration
export const API_TIMEOUT_MS = 15000 // 15 seconds
export const MAX_RETRIES = 3
export const RETRY_DELAY_MS = 1000 // Start with 1 second, will increase exponentially

// Retry fetch with exponential backoff
export async function fetchWithRetries(url: string, options = {}) {
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries < MAX_RETRIES) {
    try {
      // Add timeout to the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      
      const fetchOptions = {
        ...options,
        signal: controller.signal,
      };
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      // Return the successful response
      return response;
    } catch (error) {
      lastError = error as Error;
      retries++;
      
      if (retries >= MAX_RETRIES) {
        break;
      }
      
      // Calculate delay with exponential backoff (1s, 2s, 4s...)
      const delay = RETRY_DELAY_MS * Math.pow(2, retries - 1);
      console.warn(`API request failed, retrying (${retries}/${MAX_RETRIES}) in ${delay}ms...`, error);
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All retries failed, throw the last error
  throw lastError || new Error('Failed to fetch after retries');
}

// API Endpoints
export const ENDPOINTS = {
  FIGHTERS_SEARCH: (query: string) => `${API_URL}/api/${API_VERSION}/fighters?query=${encodeURIComponent(query)}`,
  FIGHTER: (name: string) => `${API_URL}/api/${API_VERSION}/fighter/${encodeURIComponent(name)}`,
  FIGHTERS_COUNT: `${API_URL}/api/${API_VERSION}/fighters-count`,
  PREDICTION: (fighter1: string, fighter2: string) => ({
    url: `${API_URL}/api/${API_VERSION}/prediction/predict`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fighter1_name: fighter1,
        fighter2_name: fighter2,
      }),
    },
  }),
  TRAIN_MODEL: `${API_URL}/api/${API_VERSION}/prediction/train`,
  MODEL_STATUS: `${API_URL}/api/${API_VERSION}/prediction/status`,
  UPDATE_RANKINGS: `${API_URL}/api/${API_VERSION}/prediction/update-rankings`
} as const; 