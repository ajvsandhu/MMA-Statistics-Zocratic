"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Code2, Brain, LineChart, Users } from "lucide-react"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

const features = [
  {
    title: "Our Mission",
    description: "Providing accurate statistics and predictions",
    content: "We aim to provide MMA fans and analysts with comprehensive fighter statistics and data-driven fight predictions using advanced analytics and machine learning.",
    icon: Brain
  },
  {
    title: "How It Works",
    description: "The technology behind our predictions",
    content: "Our prediction system analyzes historical fight data, fighter statistics, and various other metrics to generate accurate fight outcome predictions.",
    icon: Code2
  },
  {
    title: "Data Analysis",
    description: "Comprehensive statistical modeling",
    content: "We utilize advanced statistical models and machine learning algorithms to process and analyze fighter performance data across multiple dimensions.",
    icon: LineChart
  },
  {
    title: "Community Driven",
    description: "Built for MMA enthusiasts",
    content: "Our platform is designed with input from the MMA community, ensuring we provide the most relevant and useful information for fans and analysts alike.",
    icon: Users
  }
]

export default function AboutPage() {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="flex flex-col items-center min-h-[calc(100vh-4rem)] py-24 px-4"
    >
      <div className="w-full max-w-[980px]">
        <motion.div 
          variants={itemVariants}
          className="text-center mb-16"
        >
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
            About UFC Stats
          </h1>
          <p className="text-lg text-muted-foreground max-w-[600px] mx-auto">
            Empowering MMA fans with data-driven insights and predictions
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, x: index % 2 === 0 ? -20 : 20 },
                visible: { 
                  opacity: 1, 
                  x: 0,
                  transition: {
                    type: "spring",
                    stiffness: 100,
                    damping: 15,
                    delay: index * 0.1
                  }
                }
              }}
            >
              <Card className="bg-card/50 backdrop-blur-sm h-full transform transition-all duration-300 hover:shadow-lg overflow-hidden group">
                <CardHeader className="relative">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.1, type: "spring" }}
                    className="absolute right-4 top-4 text-primary/50 group-hover:text-primary/80 transition-colors duration-300"
                  >
                    <feature.icon className="w-6 h-6" />
                  </motion.div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.content}</p>
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
        </div>
      </div>
    </motion.div>
  )
} 