'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageBackground } from '@/components/page-background';
import { cn } from '@/lib/utils';
import { UsernameInput } from '@/components/username-input';

type AuthMode = 'login' | 'signup';

interface FormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  emailNotifications: boolean;
}

interface FormErrors {
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  emailNotifications?: string;
  general?: string;
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState<FormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    emailNotifications: true // Default to true for better engagement
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { signInWithCredentials, signUpWithCredentials, confirmSignUpWithCode, resendConfirmationCode, callPostSignupEndpoint, userProfile } = useAuth();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [signupFormData, setSignupFormData] = useState<Partial<FormData>>({}); // Preserve signup data

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 18 } },
  };
  // Only fade for fields and form
  const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Username validation (only for signup) - now handled by UsernameInput component
    if (mode === 'signup' && !isUsernameValid) {
      newErrors.username = 'Please enter a valid and available username';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (mode === 'signup' && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
         } else if (mode === 'signup' && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_])/.test(formData.password)) {
       newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
    }

    // Confirm password validation (only for signup)
    if (mode === 'signup') {
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      // TOS is automatically accepted on signup - no validation needed
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (mode === 'login') {
        await signInWithCredentials(formData.email, formData.password);
        // The signInWithCredentials will handle the redirect
      } else {
        // Preserve the signup form data before confirmation
        setSignupFormData(formData);
        
        await signUpWithCredentials({
          email: formData.email,
          password: formData.password,
          firstName: formData.username, // Using username as firstName for now
          lastName: 'User' // Default lastName
        });
        
        setShowConfirm(true);
        setConfirmationEmail(formData.email);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setErrors({ 
        general: error.message || `Failed to ${mode === 'login' ? 'sign in' : 'create account'}. Please try again.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfirming(true);
    setConfirmError(null);
    try {
      await confirmSignUpWithCode(confirmationEmail, confirmationCode);
      
      // Automatically sign in after confirmation
      await signInWithCredentials(confirmationEmail, signupFormData.password || formData.password);
      
      // Wait a moment for the session to be established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use preserved signup data to ensure we have the correct preferences
      const userData = {
        email: confirmationEmail,
        preferred_username: signupFormData.username || confirmationEmail.split('@')[0],
        emailNotifications: signupFormData.emailNotifications ?? true // Use preserved preference
      };
      
      console.log('Post-signup call with preserved data:', userData);
      
      // Call post-signup endpoint with retry logic
      let postSignupSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Post-signup attempt ${attempt}/3`);
          await callPostSignupEndpoint(userData, true); // Auto-accept TOS
          postSignupSuccess = true;
          console.log('Post-signup completed successfully');
          break;
        } catch (error) {
          console.error(`Post-signup attempt ${attempt} failed:`, error);
          if (attempt === 3) {
            console.error('All post-signup attempts failed');
            // Don't show error to user - this is handled gracefully in the backend
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      // Redirect to home after all processing is complete
      window.location.href = '/';
      
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to confirm account.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setConfirmError(null);
    try {
      await resendConfirmationCode(confirmationEmail);
      setConfirmError('A new confirmation code has been sent.');
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setFormData({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      emailNotifications: true
    });
  };

  // Confirmation code UI
  if (showConfirm) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-0">
        <PageBackground />
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className={cn(
            "max-w-sm w-full text-center relative z-10",
            "bg-card/60 backdrop-blur-xl rounded-2xl border border-border/60 shadow-2xl",
            "ring-1 ring-inset ring-[var(--primary)/20]",
            "transition-all duration-300",
            "hover:ring-2 hover:ring-[var(--primary)/40]",
            "max-h-[90vh] overflow-y-auto p-3 sm:p-5"
          )}
          style={{ boxShadow: '0 8px 32px 0 rgba(0,0,0,0.25), 0 1.5px 8px 0 hsl(var(--primary) / 0.10)' }}
        >
          <h2 className="text-xl font-bold text-foreground mb-3">Confirm Your Account</h2>
          <p className="text-muted-foreground mb-4 text-sm">Enter the 6-digit code sent to <span className="font-semibold">{confirmationEmail}</span></p>
          <form onSubmit={handleConfirm} className="space-y-4">
            <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-1">
              <Label htmlFor="confirmationCode" className="text-xs font-medium text-foreground">Confirmation Code</Label>
              <Input
                id="confirmationCode"
                type="text"
                value={confirmationCode}
                onChange={e => setConfirmationCode(e.target.value)}
                className="h-10 sm:h-11 bg-background/60 border-border/60 rounded-xl text-foreground placeholder-muted-foreground focus:bg-background/80 focus:border-primary transition-all text-center tracking-widest text-base"
                placeholder="123456"
                maxLength={6}
                autoFocus
                disabled={isConfirming}
              />
            </motion.div>
            <AnimatePresence>
              {confirmError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs"
                >{confirmError}</motion.div>
              )}
              {confirmSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="p-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 text-xs flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4 text-green-600 animate-bounce" />
                  Account confirmed! You can now sign in.
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
              <Button type="submit" disabled={isConfirming || confirmationCode.length < 6} className="w-full active:scale-95 transition-transform h-10 sm:h-11 text-sm">
                {isConfirming ? <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" /> : null}
                {isConfirming ? 'Confirming...' : 'Confirm Account'}
              </Button>
            </motion.div>
          </form>
          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              onClick={handleResend}
              className="text-xs text-primary hover:underline disabled:opacity-60"
              disabled={isResending}
            >
              {isResending ? 'Resending...' : 'Resend Code'}
            </button>
            <button
              type="button"
              onClick={() => { setShowConfirm(false); setMode('login'); }}
              className="text-xs text-muted-foreground hover:underline"
            >
              Back to Sign In
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main Auth Card
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 sm:py-20 md:-mt-32 relative z-0">
      <PageBackground />
      <LayoutGroup>
        <motion.div
          layout
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ layout: { type: 'spring', stiffness: 100, damping: 18 } }}
                     className={cn(
             "w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl relative z-10",
             "bg-card/60 backdrop-blur-xl rounded-2xl border border-border/60 overflow-hidden shadow-2xl",
             "ring-1 ring-inset ring-[var(--primary)/20]",
             "transition-all duration-300",
             "hover:ring-2 hover:ring-[var(--primary)/40]",
             "p-4 sm:p-5 md:p-6"
           )}
          style={{ boxShadow: '0 8px 32px 0 rgba(0,0,0,0.25), 0 1.5px 8px 0 hsl(var(--primary) / 0.10)' }}
        >
          {/* Back to home */}
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 mt-1 ml-1 sm:mb-3 sm:mt-2 sm:ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Zocratic MMA
          </Link>
          {/* Main Auth Card Content */}
          <div className="pt-0">
            <div className="text-center mb-2 sm:mb-3 md:mb-4">
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1"
              >
                Welcome to Zocratic MMA
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.5 }}
                className="text-muted-foreground text-xs sm:text-sm md:text-base"
              >
                {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
              </motion.p>
            </div>
            {/* Removed sign in/sign up toggle buttons here */}
          </div>

          {/* Form - AnimatePresence for the whole form content, fade only */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.form
              key={mode}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.4 }}
              onSubmit={handleSubmit}
              className="pt-0 flex flex-col gap-1 sm:gap-1.5 md:gap-2"
            >
              <AnimatePresence>
                {errors.general && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-2 text-xs"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>{errors.general}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="space-y-0.5 md:space-y-1">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                                     <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                   <Input
                     id="email"
                     type="email"
                     value={formData.email}
                     onChange={(e) => handleInputChange('email', e.target.value)}
                                         className={`pl-10 h-8 sm:h-9 md:h-10 bg-background/60 border-border/60 rounded-xl text-foreground placeholder-muted-foreground focus:bg-background/80 focus:border-primary transition-all ${
                      errors.email ? 'border-destructive' : ''
                    }`}
                     placeholder="john@example.com"
                     disabled={isLoading}
                   />
                  {errors.email && (
                    <p className="text-xs text-destructive mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Username (only for signup) */}
              {mode === 'signup' && (
                <div className="space-y-0.5 md:space-y-1">
                  <Label htmlFor="username" className="text-xs font-medium text-foreground">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <UsernameInput
                    value={formData.username}
                    onChange={(value) => handleInputChange('username', value)}
                    onValidationChange={setIsUsernameValid}
                    disabled={isLoading}
                    className="space-y-0.5"
                  />
                </div>
              )}

              {/* Password */}
              <div className="space-y-0.5 md:space-y-1">
                <Label htmlFor="password" className="text-xs font-medium text-foreground">
                  Password <span className="text-red-500">*</span>
                </Label>
                                 <div className="relative">
                   <Lock className="absolute left-3 top-2 md:top-2.5 h-4 w-4 text-muted-foreground z-10" />
                   <Input
                     id="password"
                     type={showPassword ? "text" : "password"}
                     value={formData.password}
                     onChange={(e) => handleInputChange('password', e.target.value)}
                     className={`pl-10 pr-10 h-8 sm:h-9 md:h-10 bg-background/60 border-border/60 rounded-xl text-foreground placeholder-muted-foreground focus:bg-background/80 focus:border-primary transition-all ${
                       errors.password ? 'border-destructive' : ''
                     }`}
                                          placeholder={mode === 'signup' ? '••••••••' : '••••••••'}
                     disabled={isLoading}
                     autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                   />
                   <button
                     type="button"
                     onClick={() => setShowPassword(!showPassword)}
                     className="absolute right-3 top-2 md:top-2.5 text-muted-foreground hover:text-foreground transition-colors active:scale-90 z-10"
                     aria-label="Toggle password visibility"
                   >
                    <motion.span
                      initial={{ rotate: 0 }}
                      animate={{ rotate: showPassword ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: 'inline-block' }}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </motion.span>
                  </button>
                                                          {mode === 'signup' && (
                       <p className="text-xs text-muted-foreground mt-0.5">
                         Must be at least 8 characters with uppercase, lowercase, number, and special character
                       </p>
                     )}
                   {errors.password && (
                     <p className="text-xs text-destructive mt-1">{errors.password}</p>
                   )}
                </div>
              </div>

              {/* Confirm Password (only for signup) */}
              {mode === 'signup' && (
                <div className="space-y-0.5 md:space-y-1">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                    Confirm Password <span className="text-red-500">*</span>
                  </Label>
                                     <div className="relative">
                     <Lock className="absolute left-3 top-2 md:top-2.5 h-4 w-4 text-muted-foreground z-10" />
                     <Input
                       id="confirmPassword"
                       type={showConfirmPassword ? "text" : "password"}
                       value={formData.confirmPassword}
                       onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                       className={`pl-10 pr-10 h-8 sm:h-9 md:h-10 bg-background/60 border-border/60 rounded-xl text-foreground placeholder-muted-foreground focus:bg-background/80 focus:border-primary transition-all ${
                         errors.confirmPassword ? 'border-destructive' : ''
                       }`}
                       placeholder="••••••••"
                       disabled={isLoading}
                       autoComplete="new-password"
                     />
                     <button
                       type="button"
                       onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                       className="absolute right-3 top-2 md:top-2.5 text-muted-foreground hover:text-foreground transition-colors active:scale-90 z-10"
                       aria-label="Toggle confirm password visibility"
                     >
                      <motion.span
                        initial={{ rotate: 0 }}
                        animate={{ rotate: showConfirmPassword ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'inline-block' }}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </motion.span>
                    </button>
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Email Notifications Checkbox (only for signup) */}
              {mode === 'signup' && (
                <div className="space-y-2 md:space-y-3">
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <input
                      id="emailNotifications"
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                      className="mt-0.5 md:mt-1 h-3.5 w-3.5 md:h-4 md:w-4 rounded border-border/60 bg-background/60 text-primary focus:ring-1 md:focus:ring-2 focus:ring-primary focus:ring-offset-0 transition-all"
                      disabled={isLoading}
                    />
                    <div className="flex-1">
                      <Label htmlFor="emailNotifications" className="text-xs md:text-sm font-medium text-foreground cursor-pointer">
                        📧 Email Notifications
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5 md:mt-1 leading-tight">
                        Get weekly fight reminders, results updates, and exclusive MMA insights. You can unsubscribe anytime.
                      </p>
                    </div>
                  </div>
                  
                  {/* Terms of Service Notice */}
                  <p className="text-xs text-muted-foreground text-center pt-1.5 border-t border-border/30">
                    By creating an account, you agree to our{' '}
                    <a 
                      href="/terms-of-service" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline"
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a 
                      href="/privacy-policy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline"
                    >
                      Privacy Policy
                    </a>
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-0.5 md:pt-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 sm:h-9 md:h-10 text-sm font-medium shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-95"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
                    </div>
                  ) : (
                    mode === 'login' ? 'Sign In' : 'Create Account'
                  )}
                </Button>
              </div>

              {/* Additional Info */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32, duration: 0.4 }}
                className="text-center pt-0.5 md:pt-1"
              >
                <p className="text-xs text-muted-foreground">
                  {mode === 'login' 
                    ? 'New to Zocratic MMA? ' 
                    : 'Already have an account? '
                  }
                  <button
                    type="button"
                    onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                    className="text-foreground font-medium hover:text-foreground/80 transition-colors"
                    disabled={isLoading}
                  >
                    {mode === 'login' ? 'Create an account' : 'Sign in instead'}
                  </button>
                </p>
              </motion.div>
            </motion.form>
          </AnimatePresence>
          {/* Footer */}
          <div className="text-center mt-2 sm:mt-3 md:mt-4 lg:mt-6">
            <p className="text-muted-foreground text-xs">
              Master the art of fight analysis with advanced UFC statistics
            </p>
          </div>
        </motion.div>
      </LayoutGroup>
    </div>
  );
} 