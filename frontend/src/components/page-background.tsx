"use client"

import { motion } from "framer-motion"

export function PageBackground() {
  return (
    <div className="fixed inset-0 bg-background">
      <motion.div 
        className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />
    </div>
  )
} 