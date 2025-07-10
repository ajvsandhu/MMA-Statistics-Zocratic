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
    scrollToBottom()
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
      <div className="container relative mx-auto px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <AnimatedItem variant="fadeDown" className="text-center space-y-3 mb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary rounded-xl blur opacity-50 animate-pulse"></div>
                <div className="relative bg-primary p-2.5 rounded-xl">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Zobot AI</h1>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Powered by Advanced ML</span>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your intelligent MMA companion with access to 4,305+ fighters and real-time predictions
            </p>
            
            {/* Status Badge */}
            <div className="flex justify-center">
              <Badge 
                variant={aiStatus === "available" ? "default" : "destructive"}
                className="py-1.5 px-3"
              >
                {aiStatus === "checking" && (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Initializing...
                  </>
                )}
                {aiStatus === "available" && (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                    Online & Ready
                  </>
                )}
                {aiStatus === "unavailable" && (
                  <>
                    <AlertCircle className="h-3 w-3 mr-2" />
                    Offline
                  </>
                )}
              </Badge>
            </div>
          </AnimatedItem>

          {/* Chat Container */}
          <div className="relative">
            <Card className="border-2 bg-card/50 backdrop-blur-sm shadow-lg">
              <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] max-h-[650px]">
                {/* Messages Area */}
                <CardContent className="flex-1 overflow-hidden p-0">
                  <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <AnimatedContainer className="space-y-6" delay={0.05}>
                      {messages.map((message, index) => (
                        <AnimatedItem 
                          key={message.id} 
                          variant="fadeUp" 
                          delay={index * 0.05}
                          className={`flex gap-4 ${message.isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex gap-3 max-w-[85%] lg:max-w-[75%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border-2 ${
                              message.isUser 
                                ? 'bg-primary text-primary-foreground border-primary/20' 
                                : 'bg-muted border-border'
                            }`}>
                              {message.isUser ? (
                                <User className="h-5 w-5" />
                              ) : (
                                <Bot className="h-5 w-5" />
                              )}
                            </div>
                            
                            <div className={`space-y-2 ${message.isUser ? 'text-right' : 'text-left'}`}>
                              {/* Message Bubble */}
                              <div className={`inline-block p-4 rounded-2xl shadow-sm border ${
                                message.isUser
                                  ? 'bg-primary text-primary-foreground border-primary/20 rounded-br-sm'
                                  : 'bg-card text-card-foreground border-border rounded-bl-sm'
                              }`}>
                                <div className="text-[15px] leading-relaxed">
                                  {formatMessageText(message.text)}
                                </div>
                              </div>
                              
                              {/* Timestamp */}
                              <p className="text-xs text-muted-foreground px-3">
                                {formatTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        </AnimatedItem>
                      ))}
                      
                      {/* Loading State */}
                      {isLoading && (
                        <AnimatedItem variant="fadeUp" className="flex gap-4 justify-start">
                          <div className="flex gap-3 max-w-[85%] lg:max-w-[75%]">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted border-2 border-border flex items-center justify-center shadow-sm">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div className="bg-card border border-border p-4 rounded-2xl rounded-bl-sm shadow-sm">
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="flex space-x-1">
                                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100"></div>
                                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></div>
                                </div>
                                <span className="text-sm">Zobot is analyzing...</span>
                              </div>
                            </div>
                          </div>
                        </AnimatedItem>
                      )}
                    </AnimatedContainer>
                    <div ref={messagesEndRef} />
                  </div>
                </CardContent>
                
                {/* Input Area */}
                <div className="border-t bg-background/50 backdrop-blur-sm p-4">
                  <AnimatedItem variant="fadeUp" delay={0.1}>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Textarea
                          ref={textareaRef}
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Ask me about UFC fighters, techniques, or anything MMA..."
                          className="min-h-[52px] max-h-[120px] resize-none border-2 focus:border-primary/50 rounded-xl text-[15px] leading-relaxed"
                          disabled={isLoading || aiStatus !== "available"}
                          rows={1}
                        />
                      </div>
                      <Button
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() || isLoading || aiStatus !== "available"}
                        size="lg"
                        className="h-[52px] w-[52px] p-0 rounded-xl shadow-sm"
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Info Text */}
                    <div className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>Zobot uses real UFC data and ML predictions. Results may vary.</span>
                    </div>
                  </AnimatedItem>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Custom Scrollbar Styles */}
        <style jsx global>{`
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: transparent transparent;
          }
          
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 12px;
            margin: 8px 0;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, 
              hsl(var(--primary) / 0.6) 0%, 
              hsl(var(--primary) / 0.8) 50%, 
              hsl(var(--primary) / 0.9) 100%);
            border-radius: 12px;
            border: 2px solid transparent;
            background-clip: content-box;
            box-shadow: 
              0 0 0 1px hsl(var(--primary) / 0.1),
              0 0 8px hsl(var(--primary) / 0.3),
              inset 0 1px 0 hsl(var(--primary) / 0.2);
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, 
              hsl(var(--primary) / 0.8) 0%, 
              hsl(var(--primary) / 1) 50%, 
              hsl(var(--primary) / 1) 100%);
            box-shadow: 
              0 0 0 1px hsl(var(--primary) / 0.2),
              0 0 12px hsl(var(--primary) / 0.5),
              inset 0 1px 0 hsl(var(--primary) / 0.3);
            transform: scaleY(1.1);
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:active {
            background: linear-gradient(135deg, 
              hsl(var(--primary) / 0.9) 0%, 
              hsl(var(--primary) / 1) 50%, 
              hsl(var(--primary) / 1) 100%);
            box-shadow: 
              0 0 0 1px hsl(var(--primary) / 0.3),
              0 0 16px hsl(var(--primary) / 0.7),
              inset 0 1px 0 hsl(var(--primary) / 0.4);
            transform: scaleY(1.05);
          }

          /* Cool animated gradient border effect */
          @keyframes scrollbar-glow {
            0%, 100% {
              box-shadow: 
                0 0 0 1px hsl(var(--primary) / 0.1),
                0 0 8px hsl(var(--primary) / 0.3),
                inset 0 1px 0 hsl(var(--primary) / 0.2);
            }
            50% {
              box-shadow: 
                0 0 0 1px hsl(var(--primary) / 0.2),
                0 0 12px hsl(var(--primary) / 0.5),
                inset 0 1px 0 hsl(var(--primary) / 0.3);
            }
          }
          
          .custom-scrollbar:hover::-webkit-scrollbar-thumb {
            animation: scrollbar-glow 2s ease-in-out infinite;
          }

          /* Firefox fallback with gradient */
          @supports (scrollbar-color: red blue) {
            .custom-scrollbar {
              scrollbar-color: hsl(var(--primary) / 0.7) transparent;
              scrollbar-width: thin;
            }
          }
        `}</style>
      </div>
    </PageTransition>
  )
}

export default function AIChatPage() {
  return <ZobotChatContent />
} 