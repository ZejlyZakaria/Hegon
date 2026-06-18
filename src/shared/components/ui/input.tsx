import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/utils/utils"

const inputVariants = cva(
  // Base styles (communs à tous les variants)
  "h-9 w-full min-w-0 px-3 py-1 text-sm transition-[background-color,border-color] duration-150 ease-out outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Default shadcn style (inchangé)
        default: cn(
          "rounded-control border border-input bg-transparent shadow-xs",
          "text-base md:text-sm",
          "placeholder:text-muted-foreground",
          "selection:bg-primary selection:text-primary-foreground",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "dark:bg-input/30",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
        ),
        
        // HEGON field — tokens, uniform hover (surface-2), focus = border shift
        tasks: cn(
          "rounded-control border border-border-default",
          "bg-surface-2",
          "text-text-primary placeholder:text-text-tertiary",
          "hover:bg-surface-3",
          "focus:border-border-focus",
          "aria-invalid:border-destructive",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-secondary"
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