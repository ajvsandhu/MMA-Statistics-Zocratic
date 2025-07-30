'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, Brain, Target, TrendingUp, Users, Star, Search, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPortal } from 'react-dom';

interface FighterComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FighterComparisonModal({ isOpen, onClose }: FighterComparisonModalProps) {
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
      title: "Fighter Comparison Tool",
      description: "Compare any two UFC fighters with AI-powered predictions.",
      icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Swords className="h-4 w-4 text-white" /></div>,
      content: (
        <div className="h-[180px] flex flex-col justify-between">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Our advanced AI analyzes fighter stats, fighting styles, and historical data to predict match outcomes.
            </p>
            
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Brain className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-sm">AI-Powered Analysis</p>
              <p className="text-xs text-muted-foreground">Machine learning predictions</p>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Let's see how to compare fighters and get predictions.
          </p>
        </div>
      )
    },
    {
      title: "How It Works",
      description: "Three simple steps to get AI predictions.",
      icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Target className="h-4 w-4 text-white" /></div>,
      content: (
        <div className="h-[180px] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</div>
              <div>
                <p className="font-medium text-sm">Select Two Fighters</p>
                <p className="text-xs text-muted-foreground">Search and choose any UFC fighters</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</div>
              <div>
                <p className="font-medium text-sm">Compare Stats</p>
                <p className="text-xs text-muted-foreground">View detailed physical and fighting stats</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</div>
              <div>
                <p className="font-medium text-sm">Get AI Prediction</p>
                <p className="text-xs text-muted-foreground">Receive AI-powered fight outcome prediction</p>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Our AI considers 15+ factors including striking, grappling, and experience.
          </p>
        </div>
      )
    },
    {
      title: "What You'll See",
      description: "Comprehensive fighter analysis and predictions.",
      icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><BarChart3 className="h-4 w-4 text-white" /></div>,
      content: (
        <div className="h-[180px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="bg-muted/30 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <Search className="h-3 w-3 text-primary" />
                <span className="font-semibold text-xs">Fighter Search</span>
              </div>
              <p className="text-xs text-muted-foreground">Find any UFC fighter by name</p>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-3 w-3 text-primary" />
                <span className="font-semibold text-xs">Detailed Stats</span>
              </div>
              <p className="text-xs text-muted-foreground">Physical, striking, and grappling comparisons</p>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-3 w-3 text-primary" />
                <span className="font-semibold text-xs">AI Prediction</span>
              </div>
              <p className="text-xs text-muted-foreground">Winner prediction with confidence percentage</p>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Perfect for analyzing potential matchups and understanding fighter strengths.
          </p>
        </div>
      )
    },
    {
      title: "Understanding Predictions",
      description: "How our AI analyzes and predicts fight outcomes.",
      icon: <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><TrendingUp className="h-4 w-4 text-white" /></div>,
      content: (
        <div className="h-[180px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="bg-green-100 dark:bg-green-900/20 rounded-lg p-2 border border-green-300 dark:border-green-700">
              <h4 className="font-semibold text-xs text-green-800 dark:text-green-300 mb-1">High Confidence (80%+)</h4>
              <p className="text-xs text-green-700 dark:text-green-400">Strong statistical advantage for predicted winner</p>
            </div>
            
            <div className="bg-yellow-100 dark:bg-yellow-900/20 rounded-lg p-2 border border-yellow-300 dark:border-yellow-700">
              <h4 className="font-semibold text-xs text-yellow-800 dark:text-yellow-300 mb-1">Medium Confidence (60-79%)</h4>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">Close matchup with slight edge to predicted winner</p>
            </div>
            
            <div className="bg-orange-100 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-300 dark:border-orange-700">
              <h4 className="font-semibold text-xs text-orange-800 dark:text-orange-300 mb-1">Low Confidence (50-59%)</h4>
              <p className="text-xs text-orange-700 dark:text-orange-400">Very close fight, anything can happen</p>
            </div>
          </div>
          
        
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
                    {currentStep === steps.length - 1 ? 'Start Comparing' : 'Next'}
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