"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { validateUsername, isUsernameAvailable, generateSafeUsername, UsernameValidationResult } from '@/lib/username-validation';
import { cn } from '@/lib/utils';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function UsernameInput({
  value,
  onChange,
  onValidationChange,
  disabled = false,
  required = true,
  className
}: UsernameInputProps) {
  const [validation, setValidation] = useState<UsernameValidationResult>({ isValid: true, errors: [] });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);

  const checkAvailability = useCallback(async (username: string) => {
    if (!username || validation.errors.length > 0) {
      setIsAvailable(null);
      setHasCheckedAvailability(false);
      return;
    }

    setIsCheckingAvailability(true);
    try {
      const available = await isUsernameAvailable(username);
      setIsAvailable(available);
      setHasCheckedAvailability(true);
    } catch (error) {
      console.error('Error checking username availability:', error);
      setIsAvailable(null);
      setHasCheckedAvailability(false);
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [validation.errors.length]);

  useEffect(() => {
    const result = validateUsername(value);
    setValidation(result);
    
    // Reset availability state when validation changes
    if (result.errors.length > 0) {
      setIsAvailable(null);
      setHasCheckedAvailability(false);
    }
    
    // Notify parent of validation state
    const isValid = result.isValid && (isAvailable !== false);
    onValidationChange?.(isValid);
  }, [value, isAvailable, onValidationChange]);

  useEffect(() => {
    if (value && validation.isValid) {
      const timeoutId = setTimeout(() => {
        checkAvailability(value);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [value, validation.isValid, checkAvailability]);

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
  };

  const handleGenerateRandom = () => {
    const randomUsername = generateSafeUsername();
    onChange(randomUsername);
  };

  const getStatusIcon = () => {
    if (isCheckingAvailability) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (validation.errors.length > 0) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (hasCheckedAvailability && isAvailable !== null) {
      return isAvailable ? 
        <CheckCircle className="h-4 w-4 text-green-500" /> : 
        <XCircle className="h-4 w-4 text-red-500" />;
    }
    
    return null;
  };

  const getValidationMessage = () => {
    if (validation.errors.length > 0) {
      return validation.errors[0];
    }
    
    if (hasCheckedAvailability && isAvailable === false) {
      return 'Username is already taken';
    }
    
    if (hasCheckedAvailability && isAvailable === true) {
      return 'Username is available';
    }
    
    return null;
  };

  const getValidationColor = () => {
    if (validation.errors.length > 0 || (hasCheckedAvailability && isAvailable === false)) {
      return 'text-red-600';
    }
    
    if (hasCheckedAvailability && isAvailable === true) {
      return 'text-green-600';
    }
    
    return 'text-muted-foreground';
  };

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-9 sm:h-10 bg-background/60 border-border/60 rounded-xl text-foreground placeholder-muted-foreground focus:bg-background/80 focus:border-primary transition-all pr-10",
            validation.errors.length > 0 && "border-red-500 focus:border-red-500",
            hasCheckedAvailability && isAvailable === false && "border-red-500 focus:border-red-500",
            hasCheckedAvailability && isAvailable === true && "border-green-500 focus:border-green-500"
          )}
          placeholder="Enter a unique username"
          disabled={disabled}
          autoComplete="username"
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      {/* Validation Message */}
      {getValidationMessage() && (
        <div className={cn("text-xs", getValidationColor())}>
          {getValidationMessage()}
        </div>
      )}

      {/* Generate Random Username Button */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleGenerateRandom}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 h-6 px-2 py-1 transition-colors"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Generate Random Username
        </Button>
      </div>

      {/* Suggestions */}
      {validation.suggestions && validation.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Suggestions:</p>
          <div className="flex flex-wrap gap-1">
            {validation.suggestions.map((suggestion, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={disabled}
                className="text-xs h-6 px-2 py-1"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        3-20 characters, start with letter, letters/numbers/_.-/ only
      </p>
    </div>
  );
} 