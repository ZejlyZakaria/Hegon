import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils/utils"

const textareaVariants = cva(
  // Base styles (communs à tous les variants)
  "flex w-full px-3 py-2 text-sm transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Default shadcn style (inchangé)
        default: cn(
          "field-sizing-content min-h-16 rounded-md border border-input bg-transparent shadow-xs",
          "text-base md:text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "dark:bg-input/30"
        ),
        
        // Tasks style (zinc minimal, cohérent avec input)
        tasks: cn(
          "min-h-20 rounded-lg border border-zinc-700/50",
          "bg-zinc-800/50",
          "text-zinc-100 placeholder:text-zinc-600",
          "resize-none",
          "focus:ring-1 focus:ring-zinc-700 focus:border-zinc-700",
          "aria-invalid:border-red-500/50 aria-invalid:ring-1 aria-invalid:ring-red-500/20"
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {}

function Textarea({ className, variant, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };