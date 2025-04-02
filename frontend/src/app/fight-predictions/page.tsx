"use client"

import { useState, useEffect } from "react"
import { FighterSearch } from "@/components/fighter-search"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeftRight, Swords, X, Ruler, PanelRightClose as Fist, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ENDPOINTS } from "@/lib/api-config"
import { cn } from "@/lib/utils"

interface FighterStats {
  name: string;
  image_url?: string;
  record: string;
  height: string;
  weight: string;
  reach: string;
  stance: string;
  slpm: string;
  str_acc: string;
  sapm: string;
  str_def: string;
  td_avg: string;
  td_acc: string;
  td_def: string;
  sub_avg: string;
  ranking?: string | number;
  tap_link?: string;
}

interface Prediction {
  winner: string;
  loser: string;
  winner_probability: number;
  loser_probability: number;
  prediction_confidence: number;
  model_version: string;
  fighter1: {
    name: string;
    record: string;
    image_url: string;
    probability: number;
    win_probability: string;
  };
  fighter2: {
    name: string;
    record: string;
    image_url: string;
    probability: number;
    win_probability: string;
  };
}

// Utility function to clean fighter names
const cleanFighterName = (name: string): string => {
  if (!name || name === 'undefined') return '';
  return name.includes('(') ? name.split('(')[0].trim() : name.trim();
};

// Utility function to validate fighter data
const isValidFighterData = (fighter: FighterStats | null): boolean => {
  return fighter !== null && 
         typeof fighter.name === 'string' && 
         fighter.name.trim() !== '';
};

// Utility function to safely parse numbers
const safeParseNumber = (value: string | number | undefined | null, defaultValue: number = 0): number => {
  if (value === undefined || value === null) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

// Utility function to safely parse percentage strings
const safeParsePercentage = (value: string | undefined | null): number => {
  if (!value) return 0;
  const num = parseFloat(value.replace('%', ''));
  return isNaN(num) ? 0 : num;
};

export default function FightPredictionsPage() {
  const { toast } = useToast();
  const [fighter1, setFighter1] = useState<FighterStats | null>(null);
  const [fighter2, setFighter2] = useState<FighterStats | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [particles, setParticles] = useState<Array<{
    x: number;
    y: number;
    size: number;
    delay: number;
    path: number;
  }>>([]);

  // Initialize particles on client-side only
  useEffect(() => {
    const particlesData = Array.from({ length: 10 }, (_, i) => ({
      x: 10 + (i * 8) % 80, // Spread initial positions across the screen
      y: 5 + (i * 7) % 90,
      size: i % 3 === 0 ? 2 : 1,
      delay: i * 0.2,
      path: i % 4, // Different movement patterns
    }));
    setParticles(particlesData);
  }, []);

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
      
      // Map backend field names to what our frontend expects
      const sanitizedData: FighterStats = {
        name: data?.fighter_name || data?.name || cleanName || '',
        image_url: data?.image_url || '',
        record: data?.Record || data?.record || '',
        height: data?.Height || data?.height || '',
        weight: data?.Weight || data?.weight || '',
        reach: data?.Reach || data?.reach || '',
        stance: data?.STANCE || data?.stance || '',
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

  const getComparisonColor = (val1: number, val2: number): string => {
    const diff = Math.abs(val1 - val2);
    return diff <= 0.1 ? 'text-yellow-500' : val1 > val2 ? 'text-green-500' : 'text-red-500';
  };

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
    const compareVal1 = higherIsBetter ? num1 : -num1;
    const compareVal2 = higherIsBetter ? num2 : -num2;
    
    const color1 = getComparisonColor(compareVal1, compareVal2);
    const color2 = getComparisonColor(compareVal2, compareVal1);
    
    const formatValue = (value: string | number): string => {
      if (unit === '%') {
        const numValue = String(value).replace('%', '').trim();
        return `${numValue}%`;
      }
      return String(value);
    };

    // Calculate the percentage difference for the bar widths
    const maxVal = Math.max(num1, num2);
    const width1 = maxVal > 0 ? (num1 / maxVal) * 100 : 0;
    const width2 = maxVal > 0 ? (num2 / maxVal) * 100 : 0;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group"
      >
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 py-2 items-center hover:bg-accent/5 rounded-lg transition-colors">
          {/* Left Value */}
          <div className="relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${width1}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "absolute top-0 left-0 h-full rounded-l-md opacity-10",
                color1.includes("green") ? "bg-green-500" : 
                color1.includes("red") ? "bg-red-500" : 
                "bg-yellow-500"
              )}
            />
            <div className={cn(
              "relative text-right font-medium px-2 py-0.5",
              color1
            )}>
              {formatValue(value1)}
            </div>
          </div>

          {/* Label */}
          <div className="text-center text-sm text-muted-foreground font-medium px-2 whitespace-nowrap min-w-[120px]">
            {label}
          </div>

          {/* Right Value */}
          <div className="relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${width2}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "absolute top-0 right-0 h-full rounded-r-md opacity-10",
                color2.includes("green") ? "bg-green-500" : 
                color2.includes("red") ? "bg-red-500" : 
                "bg-yellow-500"
              )}
            />
            <div className={cn(
              "relative text-left font-medium px-2 py-0.5",
              color2
            )}>
              {formatValue(value2)}
            </div>
          </div>
        </div>

        {/* Difference Indicator */}
        {Math.abs(num1 - num2) > (maxVal * 0.2) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "absolute -right-2 -top-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full",
              num1 > num2 ? "-left-2 -right-auto bg-green-500/10 text-green-500" : 
              "bg-red-500/10 text-red-500"
            )}
          >
            {Math.round(Math.abs(num1 - num2) / maxVal * 100)}% diff
          </motion.div>
        )}
      </motion.div>
    );
  };

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

      // Ensure probabilities are numbers and properly formatted
      const fighter1Prob = Number(data.fighter1?.probability || 0);
      const fighter2Prob = Number(data.fighter2?.probability || 0);
      
      // Normalize probabilities to ensure they sum to 100
      const totalProb = fighter1Prob + fighter2Prob;
      const normalizedFighter1Prob = totalProb > 0 ? Math.round((fighter1Prob / totalProb) * 100) : 50;
      const normalizedFighter2Prob = totalProb > 0 ? Math.round((fighter2Prob / totalProb) * 100) : 50;

      // Format the prediction data
      const validatedPrediction: Prediction = {
        winner: data.winner?.name || data.winner,
        loser: data.loser?.name || data.loser,
        winner_probability: Math.max(normalizedFighter1Prob, normalizedFighter2Prob),
        loser_probability: Math.min(normalizedFighter1Prob, normalizedFighter2Prob),
        prediction_confidence: data.prediction_confidence || Math.max(normalizedFighter1Prob, normalizedFighter2Prob),
        model_version: data.model_version || '1.0',
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
    
    // We can safely assert these are non-null since isValidFighterData checked
    const fighter1Name = fighter1!.name;
    const fighter2Name = fighter2!.name;
    
    getPrediction(fighter1Name, fighter2Name);
  };

  // Utility function to safely display a fighter name
  const safeDisplayName = (name: string | null | undefined): string => {
    if (!name) return 'Unknown Fighter';
    return String(name);
  };

  const PredictionModal = () => {
    if (!showPredictionModal || !prediction) return null;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowPredictionModal(false)}
        >
          {/* Animated background particles */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary/20 rounded-full"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  scale: 0,
                  opacity: 0
                }}
                animate={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: Math.random() * 8 + 8,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 3
                }}
              />
            ))}
          </motion.div>

          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ 
              duration: 0.4,
              ease: [0.19, 1, 0.22, 1],
              scale: { duration: 0.4 },
              opacity: { duration: 0.3 }
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="bg-card p-8 rounded-xl shadow-2xl w-[800px] mx-4 relative border border-border/50 overflow-hidden"
          >
            {/* Animated gradient border */}
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'linear-gradient(45deg, rgba(79, 70, 229, 0.05), rgba(79, 70, 229, 0.02))',
                maskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                WebkitMaskComposite: 'xor',
                padding: '1px'
              }}
              animate={{
                background: [
                  'linear-gradient(45deg, rgba(79, 70, 229, 0.05), rgba(79, 70, 229, 0.02))',
                  'linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(79, 70, 229, 0.02))',
                  'linear-gradient(45deg, rgba(79, 70, 229, 0.05), rgba(79, 70, 229, 0.02))'
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            />

            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowPredictionModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
            
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-2xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70"
            >
              Fight Prediction
            </motion.div>

            {isPredicting ? (
              <div className="flex items-center justify-center py-16">
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ 
                    rotate: { duration: 1.5, repeat: Infinity, ease: "linear" },
                    scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
                />
              </div>
            ) : (
              <motion.div 
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
                className="space-y-8"
              >
                {/* Fighter Names and Win Probabilities */}
                <div className="grid grid-cols-[1fr,auto,1fr] gap-8 items-center">
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    className="text-center space-y-2"
                  >
                    <motion.h4 
                      className="text-xl font-bold"
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {prediction.fighter1.name}
                    </motion.h4>
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                      className={`text-2xl font-bold ${Number(prediction.fighter1.probability) > Number(prediction.fighter2.probability) ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {prediction.fighter1.probability}%
                    </motion.div>
                    <p className="text-sm text-muted-foreground">{prediction.fighter1.record}</p>
                  </motion.div>

                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, scale: 0.8 },
                      visible: { opacity: 1, scale: 1 }
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <motion.div 
                      className="text-3xl font-bold text-primary"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      VS
                    </motion.div>
                  </motion.div>

                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, x: 20 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    className="text-center space-y-2"
                  >
                    <motion.h4 
                      className="text-xl font-bold"
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {prediction.fighter2.name}
                    </motion.h4>
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                      className={`text-2xl font-bold ${Number(prediction.fighter2.probability) > Number(prediction.fighter1.probability) ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {prediction.fighter2.probability}%
                    </motion.div>
                    <p className="text-sm text-muted-foreground">{prediction.fighter2.record}</p>
                  </motion.div>
                </div>

                {/* Winner Banner */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className="relative overflow-hidden bg-accent/10 rounded-lg"
                >
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ 
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/30 to-transparent"
                  />
                  <div className="relative text-center py-6">
                    <motion.h4 
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, type: "spring" }}
                      className="text-2xl font-bold text-primary"
                    >
                      {prediction.winner}
                    </motion.h4>
                    <p className="text-sm text-muted-foreground mt-1">Predicted Winner</p>
                  </div>
                </motion.div>

                {/* Confidence Meter */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className="space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prediction Confidence</span>
                    <span className="font-medium">{prediction.prediction_confidence}%</span>
                  </div>
                  <div className="h-2 bg-accent/20 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${prediction.prediction_confidence}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary to-primary/70"
                    />
                  </div>
                </motion.div>

                {/* Note */}
                <motion.p 
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className="text-sm text-muted-foreground text-center italic bg-accent/5 rounded-lg p-4"
                >
                  Note: This prediction is based on historical data and statistics. MMA is unpredictable, and any fighter can win on any given night.
                </motion.p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <motion.div 
      className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-background/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Grid Background */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-background/50" />

      {/* Animated Particles - Client-side only */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle, i) => (
          <motion.span
            key={i}
            className={cn(
              "absolute bg-primary/40 rounded-full",
              particle.size === 2 ? "w-2 h-2" : "w-1 h-1",
              i % 3 === 0 && "bg-primary/60"
            )}
            style={{
              top: `${particle.y}%`,
              left: `${particle.x}%`,
            }}
            initial={{ opacity: 0 }}
            animate={{
              y: particle.path === 0 
                ? [0, -50, 0] 
                : particle.path === 1 
                ? [0, 30, -30, 0]
                : particle.path === 2
                ? [0, 40, -20, 0]
                : [0, -20, 40, 0],
              x: particle.path === 0
                ? [0, 30, 0]
                : particle.path === 1
                ? [0, -40, 40, 0]
                : particle.path === 2
                ? [0, 50, -50, 0]
                : [0, -30, 30, 0],
              scale: [1, 1.2, 0.8, 1],
              opacity: [0, 0.4, 0.4, 0],
            }}
            transition={{
              duration: 12 + (particle.path * 4),
              repeat: Infinity,
              ease: "easeInOut",
              delay: particle.delay,
              times: [0, 0.4, 0.8, 1]
            }}
          />
        ))}
      </div>

      <PredictionModal />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="container relative z-10 mx-auto px-4 py-4"
      >
        {/* Hero Section - More Compact */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-4"
        >
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-2xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/90 to-primary/80"
          >
            Fight Predictions
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-muted-foreground/90 text-sm"
          >
            Compare fighter statistics and get AI-powered fight predictions.
          </motion.p>
        </motion.div>

        {/* Main Content Grid - Adjusted for better fit */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid grid-cols-[1fr,1.2fr,1fr] gap-4 max-w-[1200px] mx-auto items-start"
        >
          {/* Fighter 1 Selection */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -10 },
              visible: { opacity: 1, x: 0 }
            }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <h2 className="text-base font-semibold text-center">Fighter 1</h2>
            <div className="animate-in slide-in-from-left duration-500">
              <FighterSearch
                onSelectFighter={handleFighter1Select}
                clearSearch={!fighter1}
              />
            </div>
            {fighter1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-lg group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-all duration-300" />
                
                {fighter1.tap_link ? (
                  <motion.a
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    href={fighter1.tap_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full"
                  >
                    <img
                      src={fighter1.image_url}
                      alt={fighter1.name}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 space-y-1">
                      <h3 className="text-white text-xl font-bold relative">
                        {fighter1.name}
                        {fighter1.ranking && fighter1.ranking !== 99 && (
                          <span className="absolute -top-6 right-0 bg-primary/90 text-white text-xs px-2 py-1 rounded-full shadow-glow">
                            Rank #{fighter1.ranking}
                          </span>
                        )}
                      </h3>
                      <p className="text-white/90 text-sm">{fighter1.record}</p>
                    </div>
                  </motion.a>
                ) : (
                  <div className="w-full h-full">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <img
                      src={fighter1.image_url}
                      alt={fighter1.name}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4 group-hover:from-black/90 transition-all duration-300"
                    >
                      <h3 className="text-white text-xl font-bold">{fighter1.name}</h3>
                      <p className="text-white/90">{fighter1.record}</p>
                      {fighter1.ranking && fighter1.ranking !== 99 && (
                        <p className="text-white/90">Rank: #{fighter1.ranking}</p>
                      )}
                    </motion.div>
                  </div>
                )}
                
                {/* Add glowing effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 animate-glow" />
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Stats Comparison - Adjusted spacing */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            className="relative mt-[44px]"
          >
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 opacity-50" />
              <CardContent className="p-4 relative">
                {fighter1 && fighter2 ? (
                  <motion.div className="space-y-4">
                    {/* Stats sections */}
                    <motion.div className="space-y-4">
                      {/* Physical Stats */}
                      <div className="relative group rounded-lg bg-accent/5 p-4 hover:bg-accent/10 transition-colors">
                        <motion.div
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.4 }}
                          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary/10 rounded-full p-2"
                        >
                          <Ruler className="w-4 h-4 text-primary" />
                        </motion.div>
                        <h4 className="text-sm font-medium text-primary text-center mb-4">Physical Stats</h4>
                        <div className="space-y-3">
                          <ComparisonRow
                            label="Height"
                            value1={fighter1.height}
                            value2={fighter2.height}
                            isPhysicalStat
                          />
                          <ComparisonRow
                            label="Weight"
                            value1={fighter1.weight}
                            value2={fighter2.weight}
                            isPhysicalStat
                          />
                          <ComparisonRow
                            label="Reach"
                            value1={fighter1.reach}
                            value2={fighter2.reach}
                            isPhysicalStat
                          />
                        </div>
                      </div>

                      {/* Striking Stats */}
                      <div className="relative group rounded-lg bg-accent/5 p-4 hover:bg-accent/10 transition-colors">
                        <motion.div
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.4 }}
                          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary/10 rounded-full p-2"
                        >
                          <Fist className="w-4 h-4 text-primary" />
                        </motion.div>
                        <h4 className="text-sm font-medium text-primary text-center mb-4">Striking</h4>
                        <div className="space-y-3">
                          <ComparisonRow
                            label="Strikes Landed/min"
                            value1={fighter1.slpm}
                            value2={fighter2.slpm}
                          />
                          <ComparisonRow
                            label="Strike Accuracy"
                            value1={fighter1.str_acc}
                            value2={fighter2.str_acc}
                            unit="%"
                          />
                          <ComparisonRow
                            label="Strikes Absorbed/min"
                            value1={fighter1.sapm}
                            value2={fighter2.sapm}
                            higherIsBetter={false}
                          />
                          <ComparisonRow
                            label="Strike Defense"
                            value1={fighter1.str_def}
                            value2={fighter2.str_def}
                            unit="%"
                          />
                        </div>
                      </div>

                      {/* Grappling Stats */}
                      <div className="relative group rounded-lg bg-accent/5 p-4 hover:bg-accent/10 transition-colors">
                        <motion.div
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.4 }}
                          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary/10 rounded-full p-2"
                        >
                          <GripVertical className="w-4 h-4 text-primary" />
                        </motion.div>
                        <h4 className="text-sm font-medium text-primary text-center mb-4">Grappling</h4>
                        <div className="space-y-3">
                          <ComparisonRow
                            label="Takedowns"
                            value1={fighter1.td_avg}
                            value2={fighter2.td_avg}
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
                            label="Sub. Average"
                            value1={fighter1.sub_avg}
                            value2={fighter2.sub_avg}
                          />
                        </div>
                      </div>
                    </motion.div>

                    {/* Prediction Button - Adjusted spacing */}
                    <motion.div className="mt-4">
                      <Button
                        size="lg"
                        className={cn(
                          "relative overflow-hidden transition-all duration-300",
                          "bg-primary/10 border border-primary/20",
                          "hover:bg-primary/15 hover:border-primary/40",
                          "text-primary font-medium py-3 rounded-lg",
                          "shadow-[0_0_20px_rgba(0,0,0,0.1)]",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "group w-full"
                        )}
                        disabled={!fighter1 || !fighter2 || isPredicting}
                        onClick={handlePredictClick}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
                          initial={{ x: "-100%" }}
                          animate={fighter1 && fighter2 ? {
                            x: ["100%"],
                            opacity: [0, 1, 0]
                          } : {}}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 0.5
                          }}
                        />
                        <motion.div 
                          className="relative flex items-center justify-center gap-3"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Swords className="w-5 h-5 text-primary" />
                          <span className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                            Predict Winner
                          </span>
                        </motion.div>
                      </Button>
                      
                      {isPredicting && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 flex items-center justify-center gap-2"
                        >
                          <motion.div
                            animate={{ 
                              rotate: 360,
                              scale: [1, 1.2, 1]
                            }}
                            transition={{ 
                              rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                              scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
                            }}
                            className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full"
                          />
                          <span className="text-sm text-primary/80">Analyzing matchup...</span>
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                ) : (
                  <div className="text-center py-6">
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="text-muted-foreground"
                    >
                      Select two fighters to compare stats
                    </motion.p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Fighter 2 Selection */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: 10 },
              visible: { opacity: 1, x: 0 }
            }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <h2 className="text-base font-semibold text-center">Fighter 2</h2>
            <div className="animate-in slide-in-from-right duration-500">
              <FighterSearch
                onSelectFighter={handleFighter2Select}
                clearSearch={!fighter2}
              />
            </div>
            {fighter2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-lg group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-all duration-300" />
                
                {fighter2.tap_link ? (
                  <motion.a
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    href={fighter2.tap_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full"
                  >
                    <img
                      src={fighter2.image_url}
                      alt={fighter2.name}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 space-y-1">
                      <h3 className="text-white text-xl font-bold relative">
                        {fighter2.name}
                        {fighter2.ranking && fighter2.ranking !== 99 && (
                          <span className="absolute -top-6 right-0 bg-primary/90 text-white text-xs px-2 py-1 rounded-full shadow-glow">
                            Rank #{fighter2.ranking}
                          </span>
                        )}
                      </h3>
                      <p className="text-white/90 text-sm">{fighter2.record}</p>
                    </div>
                  </motion.a>
                ) : (
                  <div className="w-full h-full">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <img
                      src={fighter2.image_url}
                      alt={fighter2.name}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4 group-hover:from-black/90 transition-all duration-300"
                    >
                      <h3 className="text-white text-xl font-bold">{fighter2.name}</h3>
                      <p className="text-white/90">{fighter2.record}</p>
                      {fighter2.ranking && fighter2.ranking !== 99 && (
                        <p className="text-white/90">Rank: #{fighter2.ranking}</p>
                      )}
                    </motion.div>
                  </div>
                )}
                
                {/* Add glowing effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 animate-glow" />
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Footer - More compact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="relative mt-4 text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-xs text-muted-foreground/80"
          >
            Powered by advanced AI and comprehensive fight data analysis
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
} 