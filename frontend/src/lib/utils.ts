import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string into a localized format
 * @param dateString - The date string to format
 * @returns Formatted date string or 'N/A' if invalid
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error(`Error formatting date: ${dateString}`, error);
    return 'N/A';
  }
};

/**
 * Safely parses a string to a float
 * @param value - The string value to parse
 * @param defaultValue - Optional default value if parsing fails
 * @returns Parsed float value or default value
 */
export const safeParseFloat = (value: string | undefined | null, defaultValue: number = 0): number => {
  if (!value || typeof value !== 'string') return defaultValue;
  const sanitized = value.replace(/[^\d.]/g, '');
  const num = parseFloat(sanitized);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Safely formats a percentage string
 * @param value - The percentage string to format
 * @param defaultValue - Optional default value if formatting fails
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: string | undefined | null, defaultValue: string = '0%'): string => {
  if (!value || typeof value !== 'string') return defaultValue;
  const sanitized = value.replace(/%/g, '').trim();
  const num = parseFloat(sanitized);
  return isNaN(num) ? defaultValue : `${num}%`;
};

/**
 * Safely displays a value with a fallback
 * @param value - The value to display
 * @param defaultValue - Optional default value if value is invalid
 * @returns Safe display value
 */
export const safeDisplayValue = (value: unknown, defaultValue: string = 'N/A'): string => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  return String(value);
};
