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

export default function ComparePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [fighter1, setFighter1] = useState<FighterStats | null>(null);
  const [fighter2, setFighter2] = useState<FighterStats | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [showPredictionModal, setShowPredictionModal] = useState(false);

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
    <div className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-xl group bg-card max-w-[280px] mx-auto">
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
            <span className="px-3 py-1.5 rounded-full bg-black/80 text-white text-sm font-bold shadow-lg">
              {formatRanking(fighter.ranking)}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white leading-tight">
              {fighter.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base text-white/90 font-medium">{fighter.record}</p>
              {fighter.weight && (
                <>
                  <span className="text-white/50">•</span>
                  <p className="text-base text-white/90">{fighter.weight}</p>
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

    const maxVal = Math.max(num1, num2);
    const width1 = maxVal > 0 ? (num1 / maxVal) * 100 : 0;
    const width2 = maxVal > 0 ? (num2 / maxVal) * 100 : 0;

    return (
      <div className="relative group">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 py-2 items-center hover:bg-accent/5 rounded-lg transition-colors">
          <div className="relative">
            <div
              style={{ width: `${width1}%` }}
              className={cn(
                "absolute top-0 left-0 h-full rounded-l-md opacity-10 transition-all duration-500",
                color1.includes("green") ? "bg-green-500" : 
                color1.includes("red") ? "bg-red-500" : 
                "bg-yellow-500"
              )}
            />
            <div className="relative">
              <div className={cn("text-center font-medium px-2 py-0.5", color1)}>
                {formatValue(value1)}
              </div>
              {num1 !== num2 && isFirstBetter && (
                <div className="absolute -left-2 -top-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-500/10 text-green-500">
                  +{diff}
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground font-medium px-2 whitespace-nowrap min-w-[120px] text-center">
            {label}
          </div>

          <div className="relative">
            <div
              style={{ width: `${width2}%` }}
              className={cn(
                "absolute top-0 right-0 h-full rounded-r-md opacity-10 transition-all duration-500",
                color2.includes("green") ? "bg-green-500" : 
                color2.includes("red") ? "bg-red-500" : 
                "bg-yellow-500"
              )}
            />
            <div className="relative">
              <div className={cn("text-center font-medium px-2 py-0.5", color2)}>
                {formatValue(value2)}
              </div>
              {num1 !== num2 && !isFirstBetter && (
                <div className="absolute -right-2 -top-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-500/10 text-green-500">
                  +{diff}
                </div>
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
    <div className="grid grid-cols-[1fr,auto,1fr] gap-4 py-2 items-center text-center">
      <div className="text-center font-medium">
        {value1}
      </div>
      <div className="text-sm text-muted-foreground font-medium whitespace-nowrap min-w-[120px] text-center">
        {label}
      </div>
      <div className="text-center font-medium">
        {value2}
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container max-w-[1400px] mx-auto px-4 min-h-[calc(100vh-4rem)] py-8"
    >
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex items-center justify-between mb-12"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/fight-predictions')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="text-2xl font-bold">Fighter Comparison</h2>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-[350px,1fr,350px] gap-12 items-start max-w-[1400px] mx-auto"
      >
        {/* Fighter 1 Column */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Fighter 1</h3>
            {fighter1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFighter1(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="relative isolate">
            <div className="relative z-[2]">
              <FighterSearch onSelectFighter={handleFighter1Select} clearSearch={!!fighter1} />
            </div>
            <AnimatePresence>
              {fighter1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 relative z-[1]"
                >
                  <FighterCard fighter={fighter1} onRemove={() => setFighter1(null)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Center Stats Column */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="flex flex-col items-center"
        >
          {/* VS Badge */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="flex items-center justify-center mb-8"
          >
            <div className="px-8 py-3 rounded-full bg-accent/10 backdrop-blur-sm border border-border">
              <span className="text-2xl font-bold text-muted-foreground">VS</span>
            </div>
          </motion.div>

          {/* Stats Comparison */}
          {fighter1 && fighter2 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="w-full"
            >
              <Card className="bg-card/95 backdrop-blur-xl border-border/50 shadow-xl">
                <CardContent className="p-8">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1.4 }}
                    className="space-y-10"
                  >
                    {/* Physical Stats */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 1.6 }}
                    >
                      <h4 className="text-lg font-semibold mb-6 text-center">Physical Attributes</h4>
                      <div className="space-y-4">
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
                    </motion.div>

                    <Separator className="bg-border/50" />

                    {/* Striking Stats */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 1.8 }}
                    >
                      <h4 className="text-lg font-semibold mb-6 text-center">Striking</h4>
                      <div className="space-y-4">
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
                    </motion.div>

                    <Separator className="bg-border/50" />

                    {/* Grappling Stats */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 2 }}
                    >
                      <h4 className="text-lg font-semibold mb-6 text-center">Grappling</h4>
                      <div className="space-y-4">
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
                    </motion.div>
                  </motion.div>
                </CardContent>
              </Card>

              {/* Predict Button */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 2.2 }}
                className="flex justify-center mt-8"
              >
                <Button
                  size="lg"
                  onClick={handlePredictClick}
                  disabled={isPredicting}
                  className="min-w-[240px] h-14 text-lg"
                >
                  {isPredicting ? (
                    <>
                      Predicting...
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="ml-2"
                      >
                        <Swords className="h-6 w-6" />
                      </motion.div>
                    </>
                  ) : (
                    <>
                      Get Prediction
                      <Swords className="ml-2 h-6 w-6" />
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
              className="flex items-center justify-center h-[400px]"
            >
              <div className="text-center space-y-4">
                <div className="text-muted-foreground">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1.2 }}
                  >
                    <Swords className="h-16 w-16 mx-auto mb-6 opacity-50" />
                  </motion.div>
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 1.4 }}
                    className="text-xl font-medium"
                  >
                    Select two fighters to compare their statistics
                  </motion.p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Fighter 2 Column */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Fighter 2</h3>
            {fighter2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFighter2(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="relative isolate">
            <div className="relative z-[2]">
              <FighterSearch onSelectFighter={handleFighter2Select} clearSearch={!!fighter2} />
            </div>
            <AnimatePresence>
              {fighter2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 relative z-[1]"
                >
                  <FighterCard fighter={fighter2} onRemove={() => setFighter2(null)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
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