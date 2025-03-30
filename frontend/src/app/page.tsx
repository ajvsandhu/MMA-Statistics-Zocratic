"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { motion } from "framer-motion"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
}

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-4rem)]">
      <motion.section 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="flex max-w-[980px] flex-col items-center gap-8 py-24 px-4 text-center"
      >
        <motion.h1 
          variants={itemVariants}
          className="text-3xl font-bold leading-tight tracking-tighter md:text-6xl lg:leading-[1.1] bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70"
        >
          Statistics & Fight Predictions
        </motion.h1>
        
        <motion.p 
          variants={itemVariants}
          className="max-w-[750px] text-lg text-muted-foreground sm:text-xl"
        >
          Explore fighter statistics, rankings, and AI-powered fight predictions
        </motion.p>
        
        <motion.div 
          variants={itemVariants}
          className="flex gap-4"
        >
          <Link href="/fighters">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" className="font-medium">View Fighters</Button>
            </motion.div>
          </Link>
          <Link href="/fight-predictions">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="outline" className="font-medium">Fight Predictions</Button>
            </motion.div>
          </Link>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-1 gap-6 md:grid-cols-3 w-full mt-12"
        >
          {[
            {
              title: "Fighter Statistics",
              description: "Comprehensive stats for every UFC fighter",
              content: "Access detailed fighter profiles including win/loss records, striking accuracy, grappling stats, and more."
            },
            {
              title: "Fight Predictions",
              description: "AI-powered fight outcome predictions",
              content: "Get data-driven predictions for upcoming UFC fights based on historical performance and fighter matchups."
            },
            {
              title: "Rankings",
              description: "Up-to-date UFC rankings",
              content: "Stay informed with the latest UFC rankings across all weight divisions for both men and women."
            }
          ].map((card, index) => (
            <motion.div
              key={card.title}
              variants={cardVariants}
              whileHover={{ 
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
              className="relative"
            >
              <Card className="bg-card/50 backdrop-blur-sm h-full transform transition-all duration-300 hover:shadow-lg">
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{card.content}</p>
                </CardContent>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 pointer-events-none"
                  style={{
                    maskImage: "linear-gradient(to bottom, transparent, black, transparent)"
                  }}
                />
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>
    </div>
  )
}
