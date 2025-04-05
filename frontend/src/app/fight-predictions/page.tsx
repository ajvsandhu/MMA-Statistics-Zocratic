"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, Swords, PanelRightClose as Fist } from "lucide-react"

export default function FightPredictionsPage() {
  const router = useRouter()

  return (
    <div className="container relative mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Fight Predictions</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get AI-powered predictions for upcoming UFC fights based on comprehensive fighter analysis
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <Card className="bg-card/50 backdrop-blur border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Quick Prediction</h2>
                  <p className="text-muted-foreground">
                    Select two fighters and get instant predictions based on their stats and history.
                  </p>
                </div>
                <Button 
                  className="w-full bg-primary/90 hover:bg-primary text-primary-foreground"
                onClick={() => router.push('/fight-predictions/compare')}
                >
                  Start Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Event Analysis</h2>
                    <span className="text-xs font-medium bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full">WIP</span>
                  </div>
                  <p className="text-muted-foreground">
                    Get comprehensive predictions and analysis for upcoming UFC events.
                  </p>
                </div>
                <Button 
                  className="w-full bg-card hover:bg-card/80 text-foreground"
                  variant="outline"
                  disabled
                >
                  View Events <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-5xl mx-auto space-y-4">
            <h2 className="text-2xl font-semibold text-center">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-card/50 backdrop-blur border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ArrowLeftRight className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Data Analysis</h3>
                  <p className="text-muted-foreground">
                    Our AI analyzes thousands of fight statistics and historical data.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Swords className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Pattern Recognition</h3>
                  <p className="text-muted-foreground">
                    Advanced algorithms identify patterns in fighting styles and matchups.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Fist className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Prediction Generation</h3>
                  <p className="text-muted-foreground">
                    Get detailed win probability and potential outcome predictions.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    </div>
  );
} 