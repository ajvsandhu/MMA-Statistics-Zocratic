'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Coins, Target, TrendingUp, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('zocratic-onboarding-seen');
    if (seen === 'true') {
      setHasSeenOnboarding(true);
    }
  }, []);

  const steps = [
    {
      title: "Welcome to Zocratic MMA! 🥊",
      description: "Master the art of fight predictions with our advanced AI-powered platform.",
      icon: <Star className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3 text-sm">
          <p>Get ready to test your MMA knowledge and compete with other fans!</p>
          <div className="flex items-center gap-2 text-primary">
            <Coins className="h-4 w-4" />
            <span className="font-medium">Start with 1,000 free coins</span>
          </div>
        </div>
      )
    },
    {
      title: "How Predictions Work 📊",
      description: "Make picks on upcoming UFC fights and earn rewards.",
      icon: <Target className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p>Browse upcoming UFC events and available fights</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p>Analyze fighter stats, records, and recent performance</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p>Place your predictions with coin stakes</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <p>Earn rewards based on your prediction accuracy</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Scoring & Rewards 🏆",
      description: "Understand how your predictions are scored and rewarded.",
      icon: <Trophy className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
              <span>Correct Pick</span>
              <span className="font-bold text-green-600">+100%</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
              <span>Wrong Pick</span>
              <span className="font-bold text-red-600">-100%</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
              <span>Method Bonus</span>
              <span className="font-bold text-blue-600">+50%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Higher stakes = bigger rewards (and risks!)</p>
        </div>
      )
    },
    {
      title: "Leaderboard & Competition 👥",
      description: "Compete with other fans and climb the rankings.",
      icon: <Users className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium">Track your win rate and total earnings</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="font-medium">Compete on the global leaderboard</span>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-medium">Build your prediction portfolio</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">The more you play, the better you get!</p>
        </div>
      )
    },
    {
      title: "Ready to Start? 🚀",
      description: "You're all set to begin your prediction journey!",
      icon: <Star className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            <p>🎯 Start with upcoming UFC events</p>
            <p>📈 Analyze fighter statistics</p>
            <p>💰 Place your predictions</p>
            <p>🏆 Earn rewards and climb the leaderboard</p>
          </div>
          <div className="bg-primary/10 p-3 rounded-lg">
            <p className="font-medium text-primary">Pro Tip: Start with smaller stakes while you learn!</p>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('zocratic-onboarding-seen', 'true');
      onClose();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('zocratic-onboarding-seen', 'true');
    onClose();
  };

  if (hasSeenOnboarding) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md"
          >
            <Card className="bg-card/95 backdrop-blur-xl border-border/60 shadow-2xl">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {steps[currentStep].icon}
                    <div>
                      <h2 className="text-lg font-bold">{steps[currentStep].title}</h2>
                      <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="mb-6">
                  {steps[currentStep].content}
                </div>

                {/* Progress */}
                <div className="flex gap-1 mb-4">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        index <= currentStep ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-1"
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
} 