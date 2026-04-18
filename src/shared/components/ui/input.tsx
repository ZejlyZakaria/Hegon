import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/utils/utils"

const inputVariants = cva(
  // Base styles (communs à tous les variants)
  "h-9 w-full min-w-0 px-3 py-1 text-sm transition-all outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Default shadcn style (inchangé)
        default: cn(
          "rounded-md border border-input bg-transparent shadow-xs",
          "text-base md:text-sm",
          "placeholder:text-muted-foreground",
          "selection:bg-primary selection:text-primary-foreground",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "dark:bg-input/30",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
        ),
        
        // Tasks style (zinc minimal)
        tasks: cn(
          "rounded-lg border border-zinc-700/50",
          "bg-zinc-800/50",
          "text-zinc-100 placeholder:text-zinc-600",
          "hover:bg-zinc-800/80",
          "focus:ring-1 focus:ring-zinc-700 focus:border-zinc-700",
          "aria-invalid:border-red-500/50 aria-invalid:ring-1 aria-invalid:ring-red-500/20",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-400"
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface InputProps
  extends React.ComponentProps<"input">,
    VariantProps<typeof inputVariants> {}

function Input({ className, variant, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }