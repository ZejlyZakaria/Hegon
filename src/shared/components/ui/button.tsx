import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from  "@/shared/utils/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // ⚠️ `legacy` was `default` until the flip. A bare <Button> therefore rendered the
        // LOUDEST control in the app — a filled white CTA — and asking for the quiet one cost
        // a prop at every call site. The system lost by default: muscle memory (and any
        // codegen) types `<Button>`, and got shadcn. 31 of 123 call sites had drifted onto it.
        // Now the default is `quiet` and shouting must be ASKED for. This variant is kept only
        // so the flip changed zero pixels; every use of it is a call site awaiting review.
        legacy: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",

        // ── HEGON variants (graphite). The shadcn ones above speak bg-primary/bg-accent,
        // which is why every module ended up hand-rolling its controls. These are the app.
        //
        // quiet    — THE DEFAULT. The control on a page surface (filters, chevrons, ghost CTAs)
        // overlay  — over a photo/backdrop (hero, poster): flat, legible on any image
        // contrast — a white CTA on a coloured surface (StatusCard's teal, accents)
        quiet:
          "border border-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary",
        // subtle — a bare icon action inside a card/row: no border, no fill until hover.
        subtle:
          "text-text-tertiary hover:bg-surface-2 hover:text-text-primary",
        // overlay — was `glass`, and the glass was a lie: a control on a STATIC image has
        // nothing moving behind it to refract, so the blur was a still image pretending to
        // be a window. Worse, a frosted `…` that opens a plain dropdown promises a physical
        // object and delivers a list. Flat, dark, legible: it looks like what it is.
        overlay:
          "on-artwork text-white/85 hover:bg-black/85 hover:text-white",
        contrast:
          "bg-white text-surface-0 hover:bg-white/90",
        // accent — the module's own colour, passed as a CSS var so one variant serves every
        // module: <Button variant="accent" style={{ "--btn-accent": "var(--color-accent-watching)" }}>
        accent:
          "bg-(--btn-accent) text-white hover:brightness-110",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-control px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-control gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-control px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-control [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "quiet",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "quiet",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
