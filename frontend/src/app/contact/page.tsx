"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PageTransition, AnimatedContainer, AnimatedItem } from "@/components/page-transition"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail } from "lucide-react"
import { contactFormSchema, type ContactFormValues } from "@/lib/schemas"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"

// Formspree endpoint
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mldbjbww"

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: "",
      subject: "",
      message: "",
    },
  })

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true)
    try {
      // Send form data to Formspree
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Something went wrong")
      }

      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible.",
      })
      
      // Reset the form
      form.reset()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageTransition variant="default">
      <div className="container mx-auto px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <AnimatedContainer className="text-center max-w-3xl mx-auto mb-6" delay={0.1}>
            <AnimatedItem variant="fadeDown" className="mb-2">
              <Badge variant="outline" className="py-1.5 px-3 backdrop-blur-sm border-primary/20 bg-card/50">
                <span className="text-primary mr-2">📧</span>
                <span className="text-sm font-medium">Get in Touch With Us</span>
              </Badge>
            </AnimatedItem>
            <AnimatedItem variant="fadeUp" className="mb-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Contact <span className="bg-gradient-to-r from-primary via-blue-500 to-purple-500 text-transparent bg-clip-text">Zocratic MMA</span>
              </h1>
            </AnimatedItem>
            <AnimatedItem variant="fadeUp" delay={0.1}>
              <p className="text-base text-muted-foreground">
                Have suggestions, found a bug, or want to share feedback? We're eager to hear from you and improve our platform.
              </p>
            </AnimatedItem>
          </AnimatedContainer>

          {/* Contact Form */}
          <AnimatedItem variant="fadeUp" delay={0.2}>
            <Card className="p-4 sm:p-6 bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/30 transition-all duration-300">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Send us a message</h2>
                <p className="text-sm text-muted-foreground">
                  We'll get back to you within 24 hours
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="your@email.com" 
                            {...field} 
                            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Subject</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="What's this about?" 
                            {...field} 
                            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Message</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us what's on your mind..." 
                            className="min-h-[120px] transition-all duration-200 focus:ring-2 focus:ring-primary/20 resize-none"
                            {...field} 
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </Card>
          </AnimatedItem>

          {/* Additional Info */}
          <AnimatedItem variant="fadeIn" delay={0.4} className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              You can also reach us at <span className="text-foreground font-medium">contact@zocraticmma.com</span>
            </p>
          </AnimatedItem>
        </div>
      </div>
    </PageTransition>
  )
} 