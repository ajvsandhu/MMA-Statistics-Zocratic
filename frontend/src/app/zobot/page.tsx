"use client"

import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Send, Bot, User, Loader2, AlertCircle, Sparkles, MessageCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { ENDPOINTS } from "@/lib/api-config"
import { motion } from "framer-motion"

// Dynamic imports to avoid hydration issues
const PageTransition = dynamic(
  () => import("@/components/page-transition").then((mod) => mod.PageTransition),
  { ssr: false }
)
const AnimatedContainer = dynamic(
  () => import("@/components/page-transition").then((mod) => mod.AnimatedContainer),
  { ssr: false }
)
const AnimatedItem = dynamic(
  () => import("@/components/page-transition").then((mod) => mod.AnimatedItem),
  { ssr: false }
)

interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: string
}

interface ChatResponse {
  response: string
  session_id: string
  timestamp: string
  status: string
}

function ZobotChatContent() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      text: "👋 Hey there! I'm Zobot, your AI assistant for all things UFC and MMA. Ask me about fighters, techniques, predictions, or anything MMA-related!",
      isUser: false,
      timestamp: new Date().toISOString()
    }
  ])
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<"checking" | "available" | "unavailable">("checking")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    // Only scroll to bottom on initial load, not on every message
    if (messages.length === 1) {
      scrollToBottom()
    }
  }, [messages])

  useEffect(() => {
    // Check AI service status on load
    checkAIStatus()
  }, [])

  const checkAIStatus = async () => {
    try {
      const response = await fetch(ENDPOINTS.ZOBOT_STATUS)
      const data = await response.json()
      setAiStatus(data.zobot_available ? "available" : "unavailable")
    } catch (error) {
      console.error("Error checking Zobot status:", error)
      setAiStatus("unavailable")
    }
  }

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return

    if (aiStatus !== "available") {
      toast({
        title: "Zobot Unavailable",
        description: "Zobot is currently unavailable. Please try again later.",
        variant: "destructive",
      })
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText("")
    setIsLoading(true)

    try {
      const response = await fetch(ENDPOINTS.ZOBOT_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.text,
          session_id: sessionId
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ChatResponse = await response.json()

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        isUser: false,
        timestamp: data.timestamp
      }

      setMessages(prev => [...prev, aiMessage])
      setSessionId(data.session_id)

    } catch (error) {
      console.error("Error sending message:", error)
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please try again in a moment! 🤖",
        isUser: false,
        timestamp: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, errorMessage])
      
      toast({
        title: "Connection Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // Format message text with basic markdown rendering
  const formatMessageText = (text: string) => {
    // Split text into lines and process each line
    const lines = text.split('\n')
    
    return (
      <div className="space-y-2">
        {lines.map((line, lineIndex) => {
          // Handle empty lines
          if (!line.trim()) {
            return <div key={lineIndex} className="h-2" />
          }
          
          // Process markdown formatting in the line
          const parts = []
          let currentText = line
          let partIndex = 0
          
          // Process **bold** text
          const boldRegex = /\*\*(.*?)\*\*/g
          let lastIndex = 0
          let match
          
          while ((match = boldRegex.exec(line)) !== null) {
            // Add text before the bold part
            if (match.index > lastIndex) {
              parts.push(
                <span key={`text-${partIndex++}`}>
                  {line.slice(lastIndex, match.index)}
                </span>
              )
            }
            
            // Add the bold part
            parts.push(
              <strong key={`bold-${partIndex++}`} className="font-semibold">
                {match[1]}
              </strong>
            )
            
            lastIndex = match.index + match[0].length
          }
          
          // Add remaining text after the last bold part
          if (lastIndex < line.length) {
            parts.push(
              <span key={`text-${partIndex++}`}>
                {line.slice(lastIndex)}
              </span>
            )
          }
          
          // If no bold formatting found, just return the line as is
          if (parts.length === 0) {
            parts.push(<span key={`text-${partIndex++}`}>{line}</span>)
          }
          
          return (
            <div key={lineIndex} className="leading-relaxed">
              {parts}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <PageTransition variant="slide-up">
      <div className="container relative mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Chat Container */}
          <div className="relative mb-8">
            <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl">
              <div className="flex flex-col h-[calc(100vh-400px)] min-h-[400px] max-h-[600px]">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 ${
                          message.isUser
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted/50 backdrop-blur-sm border border-border/50 rounded-bl-md hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!message.isUser && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                              <Bot className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium opacity-70">
                                {message.isUser ? 'You' : 'Zobot'}
                              </span>
                              <span className="text-xs opacity-50">
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                            <div className="prose prose-sm max-w-none">
                              <div
                                className={`whitespace-pre-wrap break-words ${
                                  message.isUser ? 'text-primary-foreground' : 'text-foreground'
                                }`}
                              >
                                {formatMessageText(message.text)}
                              </div>
                            </div>
                          </div>
                          {message.isUser && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted/50 backdrop-blur-sm border border-border/50 rounded-bl-md">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                            <span className="text-sm text-muted-foreground">Zobot is thinking...</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="border-t border-border/50 bg-background/50 backdrop-blur-sm p-6">
                <AnimatedItem variant="fadeUp" delay={0.1}>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask me about UFC fighters, techniques, or anything MMA..."
                        className="min-h-[52px] max-h-[120px] resize-none border-2 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl text-[15px] leading-relaxed transition-all duration-200"
                        disabled={isLoading || aiStatus !== "available"}
                        rows={1}
                      />
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputText.trim() || isLoading || aiStatus !== "available"}
                      size="lg"
                      className="h-[52px] w-[52px] p-0 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Info Text */}
                  <div className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span>Zobot uses real UFC data and ML predictions. Results may vary.</span>
                  </div>
                </AnimatedItem>
              </div>
            </Card>
          </div>

          {/* Header - Now below the chat */}
          <AnimatedItem variant="fadeUp" className="text-center space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-primary to-primary/80 p-3 rounded-2xl shadow-lg">
                  <Bot className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-light tracking-tight">Zobot AI</h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground font-medium">Powered by Advanced ML</span>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base">
              Your intelligent MMA companion with access to 4,305+ fighters and real-time predictions
            </p>
            
            {/* Status Badge */}
            <div className="flex justify-center">
              <Badge 
                variant={aiStatus === "available" ? "default" : "destructive"}
                className="py-2 px-4 text-sm font-medium"
              >
                {aiStatus === "checking" && (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                )}
                {aiStatus === "available" && (
                  <>
                    <div className="h-2.5 w-2.5 bg-green-500 rounded-full mr-2 animate-pulse" />
                    Online & Ready
                  </>
                )}
                {aiStatus === "unavailable" && (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Offline
                  </>
                )}
              </Badge>
            </div>
          </AnimatedItem>
        </div>
      </div>
    </PageTransition>
  )
}

export default function AIChatPage() {
  return <ZobotChatContent />
} 