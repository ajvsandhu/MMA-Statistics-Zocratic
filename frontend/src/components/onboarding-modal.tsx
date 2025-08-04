'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Coins, Target, TrendingUp, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPortal } from 'react-dom';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Reset to first step when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Track if component is mounted on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const steps = [
    {
      title: "Welcome to Zocratic MMA",
      description: "Make predictions on UFC fights and compete with other fans.",
              icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Star className="h-4 w-4 text-primary-foreground" /></div>,
      content: (
        <div className="h-[200px] flex flex-col justify-between">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Test your MMA knowledge by making predictions on upcoming UFC fights using real betting odds.
            </p>
            
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Coins className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-sm">Start with 1,000 free coins</p>
              <p className="text-xs text-muted-foreground">No real money required</p>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Ready to get started? Let's learn the basics.
          </p>
        </div>
      )
    },
    {
      title: "How It Works",
      description: "Four simple steps to start making predictions.",
              icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Target className="h-4 w-4 text-primary-foreground" /></div>,
      content: (
        <div className="h-[200px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
              <div>
                <p className="font-medium text-sm">Browse Events</p>
                <p className="text-xs text-muted-foreground">Check upcoming UFC fights</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
              <div>
                <p className="font-medium text-sm">Pick Winners</p>
                <p className="text-xs text-muted-foreground">Choose who you think will win</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</div>
              <div>
                <p className="font-medium text-sm">Stake Coins</p>
                <p className="text-xs text-muted-foreground">Bet your virtual coins</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</div>
              <div>
                <p className="font-medium text-sm">Win Rewards</p>
                <p className="text-xs text-muted-foreground">Earn coins when you're right</p>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            The more accurate your predictions, the more coins you earn.
          </p>
        </div>
      )
    },
    {
      title: "Understanding Odds",
      description: "Learn how betting odds work in MMA.",
              icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Trophy className="h-4 w-4 text-primary-foreground" /></div>,
      content: (
        <div className="h-[200px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Jon Jones: -200</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">FAVORITE</span>
              </div>
              <p className="text-xs text-muted-foreground">Expected to win. Lower payout but safer bet.</p>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Tom Aspinall: +170</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">UNDERDOG</span>
              </div>
              <p className="text-xs text-muted-foreground">Less likely to win. Higher payout but riskier.</p>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Favorites have negative odds (-), underdogs have positive odds (+).
          </p>
        </div>
      )
    },
    {
      title: "Payouts",
      description: "How your winnings are calculated.",
              icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Users className="h-4 w-4 text-primary-foreground" /></div>,
      content: (
        <div className="h-[200px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="bg-green-100 dark:bg-green-900/20 rounded-lg p-2 border border-green-300 dark:border-green-700">
              <h4 className="font-semibold text-xs text-green-800 dark:text-green-300 mb-1">When You Win</h4>
              <p className="text-xs text-green-700 dark:text-green-400 mb-1">Get stake back + winnings</p>
              <div className="bg-green-50 dark:bg-green-800/30 rounded p-1 border border-green-200 dark:border-green-600">
                <p className="text-xs font-medium text-green-800 dark:text-green-200">
                  Bet 100 on +170 → Get 270 coins
                </p>
              </div>
            </div>
            
            <div className="bg-red-100 dark:bg-red-900/20 rounded-lg p-2 border border-red-300 dark:border-red-700">
              <h4 className="font-semibold text-xs text-red-800 dark:text-red-300 mb-1">When You Lose</h4>
              <p className="text-xs text-red-700 dark:text-red-400 mb-1">Lose your entire stake</p>
              <div className="bg-red-50 dark:bg-red-800/30 rounded p-1 border border-red-200 dark:border-red-600">
                <p className="text-xs font-medium text-red-800 dark:text-red-200">
                  Bet 100 coins → Lose 100 coins
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Start small, learn the fighters first.
          </p>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose();
    }
  };

  // Don't render on server side or if not mounted yet
  if (!isMounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
            padding: '1rem'
          }}
        >
          {/* Full viewport backdrop with blur covering everything */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md" 
            onClick={onClose}
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1
            }}
          />
          
          {/* Modal content centered on screen */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md"
            style={{ 
              zIndex: 2,
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-background/95 backdrop-blur-xl border shadow-2xl">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-border/50">
                  <div className="flex items-start gap-4 flex-1">
                    {steps[currentStep].icon}
                    <div className="flex-1">
                      <h2 className="text-xl font-bold mb-1">{steps[currentStep].title}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{steps[currentStep].description}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 w-8 p-0 hover:bg-muted rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {steps[currentStep].content}
                </div>

                {/* Progress */}
                <div className="px-6 pb-6">
                  <div className="flex gap-1 mb-3">
                    {steps.map((_, index) => (
                      <div
                        key={index}
                                                 className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                           index <= currentStep 
                             ? 'bg-primary' 
                             : 'bg-muted/40'
                         }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Step {currentStep + 1} of {steps.length}</span>
                    <span className="text-xs font-medium text-primary">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-6">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 h-11"
                  >
                    {currentStep === 0 ? 'Close' : 'Back'}
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-1 h-11 bg-primary hover:bg-primary/90"
                  >
                    {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render modal at document body level using portal
  return createPortal(modalContent, document.body);
} 