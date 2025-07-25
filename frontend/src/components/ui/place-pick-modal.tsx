"use client"

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { ENDPOINTS } from "@/lib/api-config"
import { useAuth } from '@/hooks/use-auth'

interface PlacePickModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  eventId: number
  fightId: string
  fighterId: number
  fighterName: string
  oddsAmerican: number
}

export function PlacePickModal({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  fightId,
  fighterId,
  fighterName,
  oddsAmerican,
}: PlacePickModalProps) {
  const { toast } = useToast()
  const { user, getToken } = useAuth()
     const [stake, setStake] = useState<number | string>('')
   const [isLoading, setIsLoading] = useState(false)
   
   // Reset stake when modal opens/closes
   useEffect(() => {
     if (!isOpen) {
       setStake('')
     }
   }, [isOpen])

     const handlePlacePick = async () => {
     if (isLoading) return // Prevent double submission
     
     if (!stake || +stake <= 0) {
       toast({
         title: "Invalid stake",
         description: "Please enter a valid amount to pick.",
         variant: "destructive",
       })
       return
     }

     setIsLoading(true)
    try {
      const token = await getToken()
      if (!token) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to place a pick.",
          variant: "destructive",
        })
        return
      }

      const requestBody = {
        event_id: eventId,
        fight_id: fightId,
        fighter_id: fighterId,
        fighter_name: fighterName,
        stake: +stake,
        odds_american: oddsAmerican,
      }

      console.log('Placing pick with data:', requestBody)

      const response = await fetch(ENDPOINTS.PLACE_PICK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

                    console.log('Response status:', response.status)
       console.log('Response headers:', response.headers.get('content-type'))
       
       const responseData = await response.json()
       console.log('Response data:', responseData)

       if (!response.ok) {
         // Handle HTTP error statuses
         const errorMessage = responseData.detail || responseData.message || `HTTP ${response.status}: Failed to place pick`
         throw new Error(errorMessage)
       }

       // Check if the response indicates success (backend returns {success: true, pick_id: "...", message: "..."})
       if (responseData.success === true) {
         toast({
           title: "🎉 Pick Placed Successfully!",
           description: `Your ${stake} coin pick on ${fighterName} has been placed! ${responseData.message || ''}`,
         })
       } else {
         // This shouldn't happen if we got HTTP 200, but let's handle it
         console.warn('Got HTTP 200 but success was not true:', responseData)
         throw new Error(responseData.message || "Pick placement status unclear")
       }
      
      // Clear the stake input
      setStake('')
      
      // Refresh balance and close modal
      onSuccess?.() // Refresh balance
      onClose()
    } catch (error) {
      console.error('Error placing pick:', error)
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
                 <DialogHeader>
           <DialogTitle>Place a Pick on {fighterName}</DialogTitle>
           <DialogDescription>
             You are placing a pick on {fighterName} with odds of {oddsAmerican > 0 ? `+${oddsAmerican}` : oddsAmerican}.
             {stake && +stake > 0 && (
               <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                 <strong>Potential Payout:</strong> {oddsAmerican > 0 
                   ? Math.round(+stake * (oddsAmerican / 100) + +stake) 
                   : Math.round(+stake * (100 / Math.abs(oddsAmerican)) + +stake)
                 } coins
               </div>
             )}
           </DialogDescription>
         </DialogHeader>
         <div className="grid gap-4 py-4">
           <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="stake" className="text-right">
               Stake (coins)
             </Label>
             <Input
               id="stake"
               type="number"
               value={stake}
               onChange={(e) => setStake(e.target.value)}
               className="col-span-3"
               placeholder="Enter amount to place"
               min="1"
             />
           </div>
         </div>
         <DialogFooter className="gap-2">
           <Button variant="outline" onClick={onClose} disabled={isLoading}>
             Cancel
           </Button>
           <Button onClick={handlePlacePick} disabled={isLoading || !stake || +stake <= 0}>
             {isLoading ? (
               <>
                 <span className="animate-spin mr-2">⏳</span>
                 Placing Pick...
               </>
             ) : (
               `Place ${stake ? `${stake} Coin ` : ''}Pick`
             )}
           </Button>
         </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 