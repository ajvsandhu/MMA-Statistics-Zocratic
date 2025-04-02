"use client"

import { motion } from "framer-motion"
import { Shield, Swords, Brain, Users, Code, Database, RefreshCw, Globe, Target, LineChart } from "lucide-react"

export default function AboutPage() {
  return (
    <motion.div 
      className="relative min-h-screen bg-gradient-to-b from-background to-background/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background Effects */}
      <div className="fixed inset-0">
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
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background opacity-80" />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="py-24 px-4">
          <div className="container max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left Side - About Content */}
              <motion.div
                className="space-y-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="flex items-center gap-4">
                  <Shield className="w-12 h-12 text-primary" />
                  <Swords className="w-12 h-12 text-primary" />
                </div>

                <div className="space-y-6">
                  <motion.h1 
                    className="text-4xl lg:text-6xl font-bold"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    Our Story at{" "}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-500">
                      Zocratic
                    </span>
                  </motion.h1>
                  
                  <motion.p 
                    className="text-xl text-muted-foreground leading-relaxed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    Born from a shared passion for MMA and data science, Zocratic emerged from countless hours of fight analysis and technical innovation.
                  </motion.p>

                  <motion.p 
                    className="text-lg text-muted-foreground/80 leading-relaxed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    Our journey began when a group of MMA enthusiasts, who also happened to be data scientists, 
                    noticed a gap between traditional fight analysis and the potential of modern technology. 
                    We set out to bridge this gap, bringing together our expertise in both worlds.
                  </motion.p>
                </div>
              </motion.div>

              {/* Right Side - Core Values */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="space-y-6"
              >
                {[
                  {
                    title: "Data-Driven Insights",
                    description: "We believe in letting the data tell the story, combining statistical analysis with deep MMA knowledge",
                    icon: Brain,
                  },
                  {
                    title: "Community Focus",
                    description: "Our platform is shaped by constant feedback from the MMA community, ensuring we serve real needs",
                    icon: Users,
                  },
                  {
                    title: "Continuous Innovation",
                    description: "We're committed to pushing the boundaries of what's possible in fight analysis",
                    icon: RefreshCw,
                  }
                ].map((value, index) => (
                  <motion.div
                    key={value.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 + (index * 0.1) }}
                    className="relative group p-6 rounded-2xl bg-background/60 backdrop-blur-sm border border-white/5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <value.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                        <p className="text-muted-foreground">{value.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Our Approach Section */}
        <section className="py-24 bg-gradient-to-b from-background to-background/90">
          <div className="container max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold mb-4">Our Approach</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                How we combine human expertise with technological innovation
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: "Deep Analysis",
                  description: "Every prediction is backed by thorough analysis of fighting styles, historical performance, and countless other factors",
                  icon: LineChart,
                  gradient: "from-primary via-purple-500 to-blue-500"
                },
                {
                  title: "Global Perspective",
                  description: "We analyze fights and fighters from around the world, providing a comprehensive view of the sport",
                  icon: Globe,
                  gradient: "from-blue-500 via-cyan-500 to-teal-500"
                },
                {
                  title: "Precision Focus",
                  description: "Our team meticulously validates each data point and model output to ensure accuracy",
                  icon: Target,
                  gradient: "from-teal-500 via-emerald-500 to-green-500"
                }
              ].map((approach, index) => (
                <motion.div
                  key={approach.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="relative group"
                >
                  <div className="h-full p-6 rounded-2xl bg-background/60 backdrop-blur-sm border border-white/5">
                    <div className="mb-4">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${approach.gradient} bg-opacity-10`}>
                        <approach.icon className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{approach.title}</h3>
                    <p className="text-muted-foreground">{approach.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="py-24 bg-gradient-to-b from-background/90 to-background">
          <div className="container max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold mb-4">Shaping the Future of MMA Analysis</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our vision extends beyond predictions - we're building a new era of fight analysis
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="group relative"
                whileHover={{ y: -5 }}
              >
                <div className="absolute -inset-0.5 rounded-2xl opacity-25 group-hover:opacity-40 transition duration-300 bg-gradient-to-r from-primary via-purple-500 to-blue-500 blur-[2px]" />
                <div className="relative h-full p-8 rounded-2xl bg-background/80 backdrop-blur-sm border border-white/10">
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300"
                    style={{
                      background: 'radial-gradient(circle at center, rgba(147, 51, 234, 0.08), transparent 70%)'
                    }}
                  />
                  <div className="relative z-10">
                    <h3 className="text-xl font-semibold mb-4">Innovation in AI</h3>
                    <p className="text-muted-foreground">
                      Pushing the boundaries of machine learning to create more accurate and nuanced fight predictions
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="group relative"
                whileHover={{ y: -5 }}
              >
                <div className="absolute -inset-0.5 rounded-2xl opacity-25 group-hover:opacity-40 transition duration-300 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 blur-[2px]" />
                <div className="relative h-full p-8 rounded-2xl bg-background/80 backdrop-blur-sm border border-white/10">
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300"
                    style={{
                      background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.08), transparent 70%)'
                    }}
                  />
                  <div className="relative z-10">
                    <h3 className="text-xl font-semibold mb-4">Community Growth</h3>
                    <p className="text-muted-foreground">
                      Building a vibrant community of fight analysts, fans, and experts who share insights and knowledge
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="group relative"
                whileHover={{ y: -5 }}
              >
                <div className="absolute -inset-0.5 rounded-2xl opacity-25 group-hover:opacity-40 transition duration-300 bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 blur-[2px]" />
                <div className="relative h-full p-8 rounded-2xl bg-background/80 backdrop-blur-sm border border-white/10">
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300"
                    style={{
                      background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08), transparent 70%)'
                    }}
                  />
                  <div className="relative z-10">
                    <h3 className="text-xl font-semibold mb-4">Future Expansion</h3>
                    <p className="text-muted-foreground">
                      Expanding our analysis to cover more combat sports and developing new ways to understand fighting
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  )
} 