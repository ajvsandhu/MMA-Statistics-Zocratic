import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input placeholder:text-muted-foreground flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-2",
        className
      )}
      {...props}
    />
  )
}

export { Input }
