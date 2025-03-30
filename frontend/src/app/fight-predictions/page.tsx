"use client"

import { useState, useEffect } from "react"
import { FighterSearch } from "@/components/fighter-search"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeftRight, Swords, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ENDPOINTS } from "@/lib/api-config"

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
  head_to_head: {
    fighter1_wins?: number;
    fighter2_wins?: number;
    last_winner?: string;
    last_method?: string;
  };
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
    
    const displayValue1 = unit === '%' ? String(value1).replace('%', '') : String(value1);
    const displayValue2 = unit === '%' ? String(value2).replace('%', '') : String(value2);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-2 py-1.5 items-center hover:bg-accent/5 rounded-lg transition-colors"
      >
        <div className={`text-right font-medium ${color1}`}>{displayValue1}</div>
        <div className="text-center text-sm text-muted-foreground font-medium px-2">{label}</div>
        <div className={`text-left font-medium ${color2}`}>{displayValue2}</div>
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

      if (!response.ok) {
        throw new Error('Failed to get prediction');
      }

      const data = await response.json();
      
      const validatedPrediction: Prediction = {
        winner: data.winner || "Unknown",
        loser: data.loser || "Unknown",
        winner_probability: data.winner_probability || 0.5,
        loser_probability: data.loser_probability || 0.5,
        prediction_confidence: data.prediction_confidence || 0.5,
        model_version: data.model_version || "1.0.0",
        head_to_head: {
          fighter1_wins: data.head_to_head?.fighter1_wins || 0,
          fighter2_wins: data.head_to_head?.fighter2_wins || 0,
          last_winner: data.head_to_head?.last_winner || "N/A",
          last_method: data.head_to_head?.last_method || "N/A",
        },
        fighter1: {
          name: cleanFighter1,
          record: data.fighter1?.record || fighter1?.record || "0-0-0",
          image_url: data.fighter1?.image_url || fighter1?.image_url || "",
          probability: data.fighter1?.name === data.winner ? data.winner_probability : data.loser_probability,
          win_probability: `${Math.round((data.fighter1?.name === data.winner ? data.winner_probability : data.loser_probability) * 100)}%`
        },
        fighter2: {
          name: cleanFighter2,
          record: data.fighter2?.record || fighter2?.record || "0-0-0",
          image_url: data.fighter2?.image_url || fighter2?.image_url || "",
          probability: data.fighter2?.name === data.winner ? data.winner_probability : data.loser_probability,
          win_probability: `${Math.round((data.fighter2?.name === data.winner ? data.winner_probability : data.loser_probability) * 100)}%`
        },
      };
      
      setPrediction(validatedPrediction);
      setShowPredictionModal(true);
    } catch (error) {
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

  const PredictionModal = () => (
    <AnimatePresence mode="wait">
      {showPredictionModal && prediction && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowPredictionModal(false)}
        >
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
            className="bg-card p-8 rounded-xl shadow-2xl w-[800px] mx-4 relative border border-border/50"
          >
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
            
            <motion.h3 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-2xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70"
            >
              Fight Prediction
            </motion.h3>

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
                    <h4 className="text-xl font-bold">{safeDisplayName(prediction?.fighter1?.name)}</h4>
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                      className={`text-lg font-medium ${safeDisplayName(prediction?.fighter1?.name) === safeDisplayName(prediction?.winner) ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {prediction?.fighter1?.win_probability || '0%'}
                    </motion.div>
                    <p className="text-sm text-muted-foreground">{prediction?.fighter1?.record}</p>
                  </motion.div>

                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, scale: 0.8 },
                      visible: { opacity: 1, scale: 1 }
                    }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="text-3xl font-bold text-primary">VS</div>
                  </motion.div>

                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, x: 20 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    className="text-center space-y-2"
                  >
                    <h4 className="text-xl font-bold">{safeDisplayName(prediction?.fighter2?.name)}</h4>
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                      className={`text-lg font-medium ${safeDisplayName(prediction?.fighter2?.name) === safeDisplayName(prediction?.winner) ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {prediction?.fighter2?.win_probability || '0%'}
                    </motion.div>
                    <p className="text-sm text-muted-foreground">{prediction?.fighter2?.record}</p>
                  </motion.div>
                </div>

                {/* Winner Banner */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  className="relative overflow-hidden"
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
                  <div className="relative text-center py-4">
                    <motion.h4 
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, type: "spring" }}
                      className="text-xl font-bold"
                    >
                      {safeDisplayName(prediction?.winner)}
                    </motion.h4>
                    <p className="text-primary">Predicted Winner</p>
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
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <PredictionModal />
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-4 max-w-5xl"
      >
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center mb-4"
        >
          <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Fight Predictions
          </h1>
          <p className="text-muted-foreground">
            Compare fighter statistics and get AI-powered fight predictions.
          </p>
        </motion.div>

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
          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start"
        >
          {/* Fighter 1 Selection */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -20 },
              visible: { opacity: 1, x: 0 }
            }}
            className="space-y-2"
          >
            <h2 className="text-lg font-semibold text-center mb-1">Fighter 1</h2>
            <div className="animate-in slide-in-from-left duration-700 delay-200">
              <FighterSearch
                onSelectFighter={handleFighter1Select}
                clearSearch={!fighter1}
              />
            </div>
            {fighter1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.4,
                  ease: [0.19, 1, 0.22, 1]
                }}
                className="relative aspect-[4/5] rounded-lg overflow-hidden group shadow-lg hover:shadow-xl transition-all duration-500"
              >
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
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
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
                  </motion.a>
                ) : (
                  <div className="w-full h-full">
                    <img
                      src={fighter1.image_url}
                      alt={fighter1.name}
                      className="w-full h-full object-cover object-top"
                    />
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4"
                    >
                      <h3 className="text-white text-xl font-bold">{fighter1.name}</h3>
                      <p className="text-white/90">{fighter1.record}</p>
                      {fighter1.ranking && fighter1.ranking !== 99 && (
                        <p className="text-white/90">Rank: #{fighter1.ranking}</p>
                      )}
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Stats Comparison */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
            className="relative"
          >
            <Card className="relative">
              <CardContent className="p-3">
                {fighter1 && fighter2 ? (
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
                    className="space-y-3"
                  >
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 200,
                        damping: 15
                      }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-full p-2 shadow-lg"
                    >
                      <Swords className="w-5 h-5 text-primary" />
                    </motion.div>

                    <h3 className="text-base font-semibold text-center mb-2 mt-3">Stats Comparison</h3>

                    {/* Physical Stats */}
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0 }
                      }}
                    >
                      <h4 className="text-sm font-medium text-primary text-center mb-1">Physical Stats</h4>
                      <div className="space-y-0.5">
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
                    </motion.div>

                    {/* Striking Stats */}
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0 }
                      }}
                    >
                      <h4 className="text-sm font-medium text-primary text-center mb-1">Striking</h4>
                      <div className="space-y-0.5">
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
                    </motion.div>

                    {/* Grappling Stats */}
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0 }
                      }}
                    >
                      <h4 className="text-sm font-medium text-primary text-center mb-1">Grappling</h4>
                      <div className="space-y-0.5">
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
                    </motion.div>

                    {/* Predict Button */}
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      className="pt-2 flex justify-center"
                    >
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          onClick={handlePredictClick}
                          className="w-full relative overflow-hidden group"
                        >
                          <motion.span
                            initial={false}
                            animate={{ x: isPredicting ? "100%" : "-100%" }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-white/20"
                          />
                          Predict Fight Outcome
                        </Button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                ) : (
                  <div className="h-[350px] flex flex-col items-center justify-center text-muted-foreground">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <motion.div
                        animate={{ 
                          rotate: [0, -10, 10, -10, 0],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          repeatDelay: 1,
                          ease: "easeInOut"
                        }}
                      >
                        <ArrowLeftRight className="w-6 h-6 mb-2 mx-auto text-primary" />
                      </motion.div>
                      <p className="text-sm">Select two fighters to compare stats</p>
                    </motion.div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Fighter 2 Selection */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: 20 },
              visible: { opacity: 1, x: 0 }
            }}
            className="space-y-2"
          >
            <h2 className="text-lg font-semibold text-center mb-1">Fighter 2</h2>
            <div className="animate-in slide-in-from-right duration-700 delay-200">
              <FighterSearch
                onSelectFighter={handleFighter2Select}
                clearSearch={!fighter2}
              />
            </div>
            {fighter2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.4,
                  ease: [0.19, 1, 0.22, 1]
                }}
                className="relative aspect-[4/5] rounded-lg overflow-hidden group shadow-lg hover:shadow-xl transition-all duration-500"
              >
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
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
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
                  </motion.a>
                ) : (
                  <div className="w-full h-full">
                    <img
                      src={fighter2.image_url}
                      alt={fighter2.name}
                      className="w-full h-full object-cover object-top"
                    />
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4"
                    >
                      <h3 className="text-white text-xl font-bold">{fighter2.name}</h3>
                      <p className="text-white/90">{fighter2.record}</p>
                      {fighter2.ranking && fighter2.ranking !== 99 && (
                        <p className="text-white/90">Rank: #{fighter2.ranking}</p>
                      )}
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
} 