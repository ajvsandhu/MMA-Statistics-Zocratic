"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ArrowLeftRight, Swords, PanelRightClose as Fist } from "lucide-react"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"

export default function FightPredictionsPage() {
  const router = useRouter()

  return (
    <PageTransition variant="slide-up">
      <div className="container relative mx-auto px-4 py-8">
        <div className="space-y-8">
          <AnimatedItem variant="fadeDown" className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Fight Predictions</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get AI-powered predictions for upcoming UFC fights based on comprehensive fighter analysis
            </p>
          </AnimatedItem>

          <AnimatedContainer className="max-w-2xl mx-auto" delay={0.2}>
            <AnimatedItem variant="fadeUp">
              <Card className="bg-card/50 backdrop-blur border-primary/20 transition-all duration-300 hover:bg-card/70 hover:shadow-lg">
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3 text-center">
                    <h2 className="text-3xl font-semibold">Quick Prediction</h2>
                    <p className="text-muted-foreground text-lg">
                      Select two fighters and get instant predictions based on their stats and history.
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-primary/90 hover:bg-primary text-primary-foreground transition-all duration-300 hover:scale-[1.02] h-12 text-lg"
                    onClick={() => router.push('/fight-predictions/compare')}
                  >
                    Start Now <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardContent>
              </Card>
            </AnimatedItem>
          </AnimatedContainer>

          <AnimatedContainer className="max-w-5xl mx-auto space-y-4" delay={0.4}>
            <AnimatedItem variant="fadeUp" className="text-center">
              <h2 className="text-2xl font-semibold">How It Works</h2>
            </AnimatedItem>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: <ArrowLeftRight className="h-5 w-5 text-primary" />,
                  title: "Data Analysis",
                  description: "Our AI analyzes thousands of fight statistics and historical data."
                },
                {
                  icon: <Swords className="h-5 w-5 text-primary" />,
                  title: "Pattern Recognition",
                  description: "Advanced algorithms identify patterns in fighting styles and matchups."
                },
                {
                  icon: <Fist className="h-5 w-5 text-primary" />,
                  title: "Prediction Generation",
                  description: "Get detailed win probability and potential outcome predictions."
                }
              ].map((item, index) => (
                <AnimatedItem key={index} variant="scale" delay={0.3 + (index * 0.1)}>
                  <Card className="bg-card/50 backdrop-blur border-primary/20 transition-all duration-300 hover:bg-card/70 hover:shadow-lg">
                    <CardContent className="p-4 space-y-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {item.icon}
                      </div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </AnimatedItem>
              ))}
            </div>
          </AnimatedContainer>
        </div>
      </div>
    </PageTransition>
  );
} 