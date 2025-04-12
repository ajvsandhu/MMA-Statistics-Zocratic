import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { FighterStats } from "@/types/fighter"
import React from "react"

/**
 * Combines multiple class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// Date and Time Utilities
// ======================

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

// Number and Percentage Utilities
// =============================

/**
 * Safely parses a string to a number
 * @param value - The value to parse
 * @param defaultValue - Optional default value if parsing fails
 * @returns Parsed number value or default value
 */
export const safeParseNumber = (value: string | number | undefined | null, defaultValue: number = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'number') return value;
  const sanitized = value.replace(/[^\d.]/g, '');
  const num = parseFloat(sanitized);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Safely formats a percentage value
 * @param value - The percentage value to format
 * @param defaultValue - Optional default value if formatting fails
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: string | number | undefined | null, defaultValue: string = '0%'): string => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'number') return `${value}%`;
  const sanitized = value.replace(/%/g, '').trim();
  const num = parseFloat(sanitized);
  return isNaN(num) ? defaultValue : `${num}%`;
};

// Fighter-specific Utilities
// ========================

/**
 * Formats a fighter's ranking
 * @param ranking - The fighter's ranking
 * @returns Formatted ranking string
 */
export const formatRanking = (ranking: string | number | null | undefined): string => {
  if (!ranking) return '';
  const rankNum = parseInt(String(ranking));
  if (isNaN(rankNum)) return '';
  if (rankNum === 1) return 'Champion';
  if (rankNum >= 2 && rankNum <= 16) return `#${rankNum - 1}`;
  return '';
};

/**
 * Cleans a fighter's name by removing parentheses and extra spaces
 * @param name - The fighter's name
 * @returns Cleaned name string
 */
export const cleanFighterName = (name: string): string => {
  if (!name || name === 'undefined') return '';
  // If the name contains a record in parentheses, extract just the name part
  const match = name.match(/^(.*?)\s*\([^)]*\)/);
  return match ? match[1].trim() : name.trim();
};

/**
 * Validates fighter data
 * @param fighter - The fighter object to validate
 * @returns Boolean indicating if the fighter data is valid
 */
export const isValidFighterData = (fighter: unknown): fighter is FighterStats => {
  return fighter !== null && 
         typeof fighter === 'object' &&
         'name' in fighter && 
         typeof (fighter as FighterStats).name === 'string' && 
         (fighter as FighterStats).name.trim() !== '';
};

/**
 * Gets the color class for comparison values
 * @param val1 - First value
 * @param val2 - Second value
 * @returns Tailwind color class
 */
export const getComparisonColor = (val1: number, val2: number): string => {
  const diff = Math.abs(val1 - val2);
  return diff <= 0.1 ? 'text-yellow-500' : val1 > val2 ? 'text-green-500' : 'text-red-500';
};

/**
 * Safely formats a value with optional unit
 * @param value - The value to format
 * @param unit - Optional unit to append
 * @returns Formatted string
 */
export const formatValue = (value: string | number, unit: string = ''): string => {
  if (unit === '%') {
    const numValue = String(value).replace('%', '').trim();
    return `${numValue}%`;
  }
  return String(value);
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

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile
}

/**
 * Creates a clean URL slug for a fighter
 * @param name - The fighter's full name with record
 * @returns A clean URL-friendly slug
 */
export const createFighterSlug = (name: string): string => {
  // Remove any " - N/A" or weight class information after the record
  const cleanedName = name.replace(/ - .*$/, '');
  
  // Extract name and record parts
  const nameParts = cleanedName.match(/^(.*?)\s*\(([^)]*)\)/);
  
  if (!nameParts) {
    // If no record found, just slugify the name
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single ones
      .trim();
  }
  
  const fighterName = nameParts[1].trim();
  const record = nameParts[2].trim();
  
  // Create slug from name
  const nameSlug = fighterName.toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single ones
    .trim();
  
  // Clean up record for URL
  const recordSlug = record
    .replace(/\s+/g, '')       // Remove spaces
    .replace(/\(|\)/g, '')     // Remove parentheses
    .toLowerCase();
  
  // Combine name and record for the final slug
  return `${nameSlug}-${recordSlug}`;
};

/**
 * Parses a fighter slug back into components
 * @param slug - The URL slug to parse
 * @returns An object with name and record
 */
export const parseFighterSlug = (slug: string): { name: string, record: string } => {
  // Find where the record starts (pattern looking for numbers-numbers-numbers at the end)
  const recordMatch = slug.match(/(.*)-(\d+-\d+-\d+(?:\d+nc)?)$/);
  
  if (!recordMatch) {
    // If no record pattern found, just convert hyphens back to spaces
    return {
      name: slug.replace(/-/g, ' '),
      record: ''
    };
  }
  
  const nameSlug = recordMatch[1];
  const recordSlug = recordMatch[2];
  
  // Convert name slug back to readable format
  const name = nameSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word
  
  // Format record with parentheses
  const record = `(${recordSlug.replace(/(\d+)nc/, '$1 NC')})`;
  
  return { name, record };
};
