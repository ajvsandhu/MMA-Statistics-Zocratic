"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertTriangle, ExternalLink, Shield } from "lucide-react";

export default function AntiGamblingModal() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem('zocratic-anti-gambling-popup');
      if (!seen) setShow(true);
    }
  }, []);
  
  const handleClose = () => {
    setShow(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zocratic-anti-gambling-popup', '1');
    }
  };
  
  return (
    <Dialog open={show} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-xl font-bold">
            We Condemn Real Gambling
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4 text-muted-foreground text-sm">
          <div className="flex items-start gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground mb-2">Educational Purpose Only</div>
              <div className="text-sm text-muted-foreground">
                Zocratic MMA is strictly for entertainment, education, and virtual picks only. We do not promote or profit from real-money gambling.
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="text-sm text-muted-foreground mb-3">
              Gambling can lead to serious harm. Learn more about the risks:
            </div>
            <a 
              href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6492282/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
            >
              <span>Understanding Gambling Harms (NIH)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <button className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors">
              I Understand
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 