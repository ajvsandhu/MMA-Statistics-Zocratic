"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FighterSearch } from "@/components/fighter-search"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, X, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ENDPOINTS } from "@/lib/api-config"
import { cn } from "@/lib/utils"
import { FighterStats, Prediction } from "@/types/fighter"
import { getAnimationVariants, fadeAnimation } from '@/lib/animations'
import { useMediaQuery } from '@/hooks/use-media-query'

export default function ComparePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [fighter1, setFighter1] = useState<FighterStats | null>(null);
  const [fighter2, setFighter2] = useState<FighterStats | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const animationVariants = getAnimationVariants(isMobile)

  const fetchFighterData = async (fighterName: string): Promise<FighterStats | null> => {
    try {
      const cleanName = cleanFighterName(fighterName);
      if (!cleanName) {
        toast({
          title: 'Error',
          description: 'Invalid fighter name',
          variant: 'destructive',
        });
        return null;
      }
      
      const response = await fetch(ENDPOINTS.FIGHTER(cleanName));
      if (!response.ok) throw new Error('Fighter not found');
      
      const data = await response.json();
      
      const sanitizedData: FighterStats = {
        name: data?.fighter_name || data?.name || cleanName || '',
        image_url: data?.image_url || '',
        record: data?.Record || data?.record || '',
        height: data?.Height || data?.height || '',
        weight: data?.Weight || data?.weight || '',
        reach: data?.Reach || data?.reach || '',
        stance: data?.STANCE || data?.stance || '',
        dob: data?.dob || data?.date_of_birth || '',
        slpm: data?.SLpM || data?.SLPM || data?.slpm || '0',
        str_acc: data?.['Str. Acc.'] || data?.str_acc || '0%',
        sapm: data?.SApM || data?.SAPM || data?.sapm || '0',
        str_def: data?.['Str. Def'] || data?.str_def || '0%',
        td_avg: data?.['TD Avg.'] || data?.td_avg || '0',
        td_acc: data?.['TD Acc.'] || data?.td_acc || '0%',
        td_def: data?.['TD Def.'] || data?.td_def || '0%',
        sub_avg: data?.['Sub. Avg.'] || data?.sub_avg || '0',
        ranking: data?.ranking || 0,
      };
      
      return sanitizedData;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Fighter not found. Please try another fighter.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleFighterSelect = async (name: string, setFighter: (fighter: FighterStats | null) => void) => {
    const cleanName = cleanFighterName(name);
    if (!cleanName) {
      toast({
        title: 'Error',
        description: 'Invalid fighter name selected',
        variant: 'destructive',
      });
      return;
    }
    
    setIsPredicting(true);
    const data = await fetchFighterData(cleanName);
    setFighter(data);
    setIsPredicting(false);
  };

  const handleFighter1Select = (name: string) => handleFighterSelect(name, setFighter1);
  const handleFighter2Select = (name: string) => handleFighterSelect(name, setFighter2);

  const getPrediction = async (fighter1Name: string, fighter2Name: string) => {
    const cleanFighter1 = cleanFighterName(fighter1Name);
    const cleanFighter2 = cleanFighterName(fighter2Name);
    
    if (!cleanFighter1 || !cleanFighter2) {
      toast({
        title: 'Error',
        description: 'Please select two fighters to compare',
        variant: 'destructive',
      });
      return;
    }
    
    setIsPredicting(true);
    try {
      const predictionEndpoint = ENDPOINTS.PREDICTION(cleanFighter1, cleanFighter2);
      const response = await fetch(predictionEndpoint.url, predictionEndpoint.options);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          toast({
            title: 'Service Temporarily Unavailable',
            description: data.message || 'The prediction service is temporarily unavailable. Please try again later.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: data.detail || 'Failed to get prediction. Please try again.',
            variant: 'destructive',
          });
        }
        return;
      }

      const fighter1Prob = Number(data.fighter1?.probability || 0);
      const fighter2Prob = Number(data.fighter2?.probability || 0);
      
      const totalProb = fighter1Prob + fighter2Prob;
      const normalizedFighter1Prob = totalProb > 0 ? Math.round((fighter1Prob / totalProb) * 100) : 50;
      const normalizedFighter2Prob = totalProb > 0 ? Math.round((fighter2Prob / totalProb) * 100) : 50;

      const validatedPrediction: Prediction = {
        winner: data.winner?.name || data.winner,
        loser: data.loser?.name || data.loser,
        winner_probability: Math.max(normalizedFighter1Prob, normalizedFighter2Prob),
        loser_probability: Math.min(normalizedFighter1Prob, normalizedFighter2Prob),
        prediction_confidence: data.prediction_confidence || Math.max(normalizedFighter1Prob, normalizedFighter2Prob),
        model_version: data.model_version || '1.0',
        head_to_head: {
          fighter1_wins: data.head_to_head?.fighter1_wins || 0,
          fighter2_wins: data.head_to_head?.fighter2_wins || 0,
          last_winner: data.head_to_head?.last_winner || '',
          last_method: data.head_to_head?.last_method || ''
        },
        fighter1: {
          name: data.fighter1?.name || cleanFighter1,
          record: data.fighter1?.record || '',
          image_url: data.fighter1?.image_url || '',
          probability: normalizedFighter1Prob,
          win_probability: `${normalizedFighter1Prob}%`
        },
        fighter2: {
          name: data.fighter2?.name || cleanFighter2,
          record: data.fighter2?.record || '',
          image_url: data.fighter2?.image_url || '',
          probability: normalizedFighter2Prob,
          win_probability: `${normalizedFighter2Prob}%`
        }
      };

      setPrediction(validatedPrediction);
      setShowPredictionModal(true);
    } catch (error) {
      console.error('Prediction error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get prediction. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPredicting(false);
    }
  };

  const handlePredictClick = () => {
    if (!isValidFighterData(fighter1) || !isValidFighterData(fighter2)) {
      toast({
        title: 'Error',
        description: 'Both fighters must be selected with valid data',
        variant: 'destructive',
      });
      return;
    }
    
    const fighter1Name = fighter1!.name;
    const fighter2Name = fighter2!.name;
    
    getPrediction(fighter1Name, fighter2Name);
  };

  const FighterCard = ({ fighter, onRemove }: { fighter: FighterStats, onRemove: () => void }) => (
    <div className="relative aspect-[3/2] rounded-xl overflow-hidden shadow-xl group bg-card">
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-80 z-10" />
      
      <div className="absolute inset-0">
        <img
          src={fighter.image_url || '/placeholder-fighter.png'}
          alt={fighter.name}
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
      </div>

      <div className="absolute inset-0 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70"
          onClick={onRemove}
        >
          <X className="h-4 w-4 text-white" />
        </Button>

        {fighter.ranking && fighter.ranking !== '99' && fighter.ranking !== 99 && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 rounded-full bg-black/80 text-white text-xs font-bold shadow-lg">
              {formatRanking(fighter.ranking)}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white leading-tight">
              {fighter.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-white/90 font-medium">{fighter.record}</p>
              {fighter.weight && (
                <>
                  <span className="text-white/50">•</span>
                  <p className="text-sm text-white/90">{fighter.weight}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ComparisonRow = ({ label, value1, value2, higherIsBetter = true, unit = '', isPhysicalStat = false }: { 
    label: string;
    value1: string | number;
    value2: string | number;
    higherIsBetter?: boolean;
    unit?: string;
    isPhysicalStat?: boolean;
  }) => {
    const parseValue = (value: string | number): number => {
      if (isPhysicalStat) {
        const match = String(value).match(/(\d+)/);
        return match ? Number(match[1]) : 0;
      }
      if (unit === '%') {
        return safeParsePercentage(String(value));
      }
      return safeParseNumber(value);
    };

    const num1 = parseValue(value1);
    const num2 = parseValue(value2);
    
    const rawDiff = Math.abs(num1 - num2);
    const diff = rawDiff.toFixed(2);
    
    const isFirstBetter = higherIsBetter ? num1 > num2 : num1 < num2;
    
    const color1 = num1 > num2 ? 
      (higherIsBetter ? 'text-green-500' : 'text-red-500') : 
      num1 < num2 ? 
        (higherIsBetter ? 'text-red-500' : 'text-green-500') : 
        'text-yellow-500';
        
    const color2 = num2 > num1 ? 
      (higherIsBetter ? 'text-green-500' : 'text-red-500') : 
      num2 < num1 ? 
        (higherIsBetter ? 'text-red-500' : 'text-green-500') : 
        'text-yellow-500';
    
    const formatValue = (value: string | number): string => {
      if (unit === '%') {
        const numValue = String(value).replace('%', '').trim();
        return `${numValue}%`;
      }
      return String(value);
    };

    const width1 = num1;
    const width2 = num2;

    return (
      <div className="relative group">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-2 py-1.5 items-center hover:bg-accent/5 rounded-lg">
          <div className="relative min-h-[24px]">
            <div
              style={{ width: `${width1}%` }}
              className={cn(
                "absolute top-0 left-0 h-full rounded-l-md opacity-10",
                color1.includes("green") ? "bg-green-500" : 
                color1.includes("red") ? "bg-red-500" : 
                "bg-yellow-500"
              )}
            />
            <div className="relative flex items-center justify-center">
              <div className={cn("font-medium", color1)}>
                {formatValue(value1)}
              </div>
              {num1 !== num2 && isFirstBetter && (
                <span className="ml-1 text-[10px] font-medium text-green-500">
                  (+{diff})
                </span>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground font-medium px-1.5 whitespace-nowrap min-w-[80px] text-center">
            {label}
          </div>

          <div className="relative min-h-[24px]">
            <div
              style={{ width: `${width2}%` }}
              className={cn(
                "absolute top-0 right-0 h-full rounded-r-md opacity-10",
                color2.includes("green") ? "bg-green-500" : 
                color2.includes("red") ? "bg-red-500" : 
                "bg-yellow-500"
              )}
            />
            <div className="relative flex items-center justify-center">
              <div className={cn("font-medium", color2)}>
                {formatValue(value2)}
              </div>
              {num1 !== num2 && !isFirstBetter && (
                <span className="ml-1 text-[10px] font-medium text-green-500">
                  (+{diff})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SimpleComparisonRow = ({ label, value1, value2 }: { 
    label: string;
    value1: string;
    value2: string;
  }) => (
    <div className="grid grid-cols-[1fr,auto,1fr] gap-2 py-1 items-center text-center text-sm">
      <div className="text-center font-medium">
        {value1}
      </div>
      <div className="text-[11px] text-muted-foreground font-medium whitespace-nowrap min-w-[90px] text-center">
        {label}
      </div>
      <div className="text-center font-medium">
        {value2}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 pt-[65px]">
      <div className="h-[calc(100vh-65px)] px-2 sm:px-4 lg:px-8 overflow-y-auto pb-safe">
        <motion.div 
          className="h-full flex flex-col pt-4 sm:pt-8 max-w-[1400px] mx-auto"
          {...(isMobile ? fadeAnimation : animationVariants.page)}
        >
          {/* Header */}
          <div className="flex items-center justify-between h-12 mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => router.push('/fight-predictions')}
                className="gap-1 px-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Back</span>
              </Button>
              <h2 className="text-lg sm:text-xl font-bold">Fighter Comparison</h2>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[350px,1fr,350px] gap-4 lg:gap-6 overflow-visible">
            {/* Fighter 1 Column */}
            <div className="flex flex-col">
              <h3 className="text-base sm:text-lg font-semibold mb-1">Fighter 1</h3>
              <div className="relative z-30">
                <FighterSearch onSelectFighter={handleFighter1Select} clearSearch={!!fighter1} />
              </div>
              <div className="mt-2 flex-1">
                <AnimatePresence mode="wait">
                  {fighter1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FighterCard fighter={fighter1} onRemove={() => setFighter1(null)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Center Stats Column */}
            <div className="flex flex-col">
              {/* VS Badge and Predict Button */}
              <div className="flex flex-col items-center mb-2">
                <div className="px-2.5 py-0.5 rounded-full bg-accent/10 backdrop-blur-sm border border-border">
                  <span className="text-sm font-bold text-muted-foreground">VS</span>
                </div>
                
                {fighter1 && fighter2 && (
                  <Button
                    size="sm"
                    onClick={handlePredictClick}
                    disabled={isPredicting}
                    className="w-[200px] mt-2 shadow-lg"
                  >
                    {isPredicting ? (
                      <>
                        Predicting...
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="ml-1.5"
                        >
                          <Swords className="h-3.5 w-3.5" />
                        </motion.div>
                      </>
                    ) : (
                      <>
                        Get Prediction
                        <Swords className="ml-1.5 h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Stats Comparison */}
              <div className="flex-1">
                {fighter1 && fighter2 ? (
                  <motion.div
                    initial={isMobile ? {} : { opacity: 0, y: 20 }}
                    animate={isMobile ? {} : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-card/95 backdrop-blur-xl border-border/50 shadow-xl max-w-[400px] mx-auto">
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          {/* Physical Stats */}
                          <div>
                            <h4 className="text-xs font-medium mb-1 text-center text-muted-foreground">Physical Attributes</h4>
                            <div className="space-y-1">
                              <SimpleComparisonRow
                                label="Height"
                                value1={fighter1.height}
                                value2={fighter2.height}
                              />
                              <SimpleComparisonRow
                                label="Weight"
                                value1={fighter1.weight}
                                value2={fighter2.weight}
                              />
                              <SimpleComparisonRow
                                label="Reach"
                                value1={fighter1.reach}
                                value2={fighter2.reach}
                              />
                              <SimpleComparisonRow
                                label="Stance"
                                value1={fighter1.stance}
                                value2={fighter2.stance}
                              />
                            </div>
                          </div>

                          <Separator className="bg-border/50" />

                          {/* Striking Stats */}
                          <div>
                            <h4 className="text-xs font-medium mb-1 text-center text-muted-foreground">Striking</h4>
                            <div className="space-y-1">
                              <ComparisonRow
                                label="Strikes Landed per Min"
                                value1={fighter1.slpm}
                                value2={fighter2.slpm}
                                unit=""
                              />
                              <ComparisonRow
                                label="Striking Accuracy"
                                value1={fighter1.str_acc}
                                value2={fighter2.str_acc}
                                unit="%"
                              />
                              <ComparisonRow
                                label="Strikes Absorbed per Min"
                                value1={fighter1.sapm}
                                value2={fighter2.sapm}
                                higherIsBetter={false}
                                unit=""
                              />
                              <ComparisonRow
                                label="Striking Defense"
                                value1={fighter1.str_def}
                                value2={fighter2.str_def}
                                unit="%"
                              />
                            </div>
                          </div>

                          <Separator className="bg-border/50" />

                          {/* Grappling Stats */}
                          <div>
                            <h4 className="text-xs font-medium mb-1 text-center text-muted-foreground">Grappling</h4>
                            <div className="space-y-1">
                              <ComparisonRow
                                label="Takedowns per 15 Min"
                                value1={fighter1.td_avg}
                                value2={fighter2.td_avg}
                                unit=""
                              />
                              <ComparisonRow
                                label="Takedown Accuracy"
                                value1={fighter1.td_acc}
                                value2={fighter2.td_acc}
                                unit="%"
                              />
                              <ComparisonRow
                                label="Takedown Defense"
                                value1={fighter1.td_def}
                                value2={fighter2.td_def}
                                unit="%"
                              />
                              <ComparisonRow
                                label="Submissions per 15 Min"
                                value1={fighter1.sub_avg}
                                value2={fighter2.sub_avg}
                                unit=""
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-muted-foreground">
                        <Swords className="h-8 w-8 mx-auto mb-1 opacity-50" />
                        <p className="text-sm font-medium">
                          Select two fighters to compare
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fighter 2 Column */}
            <div className="flex flex-col">
              <h3 className="text-base sm:text-lg font-semibold mb-1">Fighter 2</h3>
              <div className="relative z-30">
                <FighterSearch onSelectFighter={handleFighter2Select} clearSearch={!!fighter2} />
              </div>
              <div className="mt-2 flex-1">
                <AnimatePresence mode="wait">
                  {fighter2 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FighterCard fighter={fighter2} onRemove={() => setFighter2(null)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Prediction Modal */}
      <AnimatePresence>
        {showPredictionModal && (
          <motion.div
            {...(isMobile ? fadeAnimation : animationVariants.modal)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShowPredictionModal(false)}
          >
            <div 
              className="relative w-full max-w-lg mx-4 rounded-lg border bg-card p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Fight Prediction</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPredictionModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Winner Prediction */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Predicted Winner</p>
                  <h4 className="text-2xl font-bold text-primary">
                    {prediction?.winner}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Confidence: {prediction?.prediction_confidence}%
                  </p>
                </div>

                {/* Probability Bars */}
                <div className="mt-2 space-y-3">
                  <motion.div
                    {...(isMobile ? fadeAnimation : animationVariants.listItem)}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between text-sm">
                      <span>{prediction?.fighter1.name}</span>
                      <span>{prediction?.fighter1.win_probability}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        style={{ width: `${prediction?.fighter1.probability || 0}%` }}
                        className="h-full bg-primary transition-[width] duration-500 ease-out"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    {...(isMobile ? fadeAnimation : animationVariants.listItem)}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between text-sm">
                      <span>{prediction?.fighter2.name}</span>
                      <span>{prediction?.fighter2.win_probability}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        style={{ width: `${prediction?.fighter2.probability || 0}%` }}
                        className="h-full bg-primary transition-[width] duration-500 ease-out"
                      />
                    </div>
                  </motion.div>
                </div>

                {/* Model Info */}
                <div className="text-xs text-center text-muted-foreground mt-2">
                  Model Version: {prediction?.model_version}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Utility functions
const cleanFighterName = (name: string): string => {
  if (!name || name === 'undefined') return '';
  return name.includes('(') ? name.split('(')[0].trim() : name.trim();
};

const isValidFighterData = (fighter: FighterStats | null): boolean => {
  return fighter !== null && 
         typeof fighter.name === 'string' && 
         fighter.name.trim() !== '';
};

const safeParseNumber = (value: string | number | undefined | null, defaultValue: number = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

const safeParsePercentage = (value: string | undefined | null): number => {
  if (!value) return 0;
  const num = parseFloat(value.replace('%', ''));
  return isNaN(num) ? 0 : num;
};

const formatRanking = (ranking: string | number | null | undefined): string => {
  if (!ranking) return '';
  const rankNum = parseInt(String(ranking));
  if (isNaN(rankNum)) return '';
  if (rankNum === 1) return 'Champion';
  if (rankNum >= 2 && rankNum <= 16) return `#${rankNum - 1}`;
  return '';
}; 