"use client"

import { motion } from "framer-motion"

export function PageBackground() {
  return (
    <div className="fixed inset-0 bg-[var(--app-bg,hsl(var(--background)))] overflow-hidden">
      {/* Base theme gradient */}
      <div 
        className="absolute inset-0 opacity-100"
        style={{
          background: 'var(--app-gradient, radial-gradient(circle at top center, rgba(79, 70, 229, 0.08) 0%, rgba(67, 56, 202, 0.04) 25%, rgba(55, 48, 163, 0.02) 50%, transparent 100%))'
        }}
      />
      
      {/* Ambient lighting effect */}
      <motion.div 
        className="absolute inset-0 opacity-50"
        style={{
          background: 'var(--ambient-light, radial-gradient(circle at 50% -20%, rgba(79, 70, 229, 0.1), rgba(67, 56, 202, 0.05) 20%, transparent 50%))'
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 2 }}
      />
      
      {/* Subtle grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Dynamic particle effect */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 3 }}
      >
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-96 h-96 rounded-full opacity-5"
            style={{
              background: `radial-gradient(circle, var(--gradient-start, rgba(79, 70, 229, 0.1)), transparent 70%)`,
              left: `${20 + i * 30}%`,
              top: `${10 + i * 25}%`,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.05, 0.1, 0.05],
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 15 + i * 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </motion.div>
      
      {/* Subtle vignette effect */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, transparent 50%, rgba(0,0,0,0.1) 100%)'
        }}
      />
    </div>
  )
} 