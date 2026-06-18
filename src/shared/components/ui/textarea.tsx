import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils/utils"

const textareaVariants = cva(
  // Base styles (communs à tous les variants)
  "flex w-full px-3 py-2 text-sm transition-[background-color,border-color] duration-150 ease-out outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
        
        // HEGON field — matches the Input "tasks" variant exactly
        tasks: cn(
          "min-h-20 resize-none rounded-control border border-border-default",
          "bg-surface-2",
          "text-text-primary placeholder:text-text-tertiary",
          "hover:bg-surface-3",
          "focus:border-border-focus",
          "aria-invalid:border-destructive"
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