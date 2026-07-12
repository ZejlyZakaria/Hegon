import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge doesn't know our custom theme scales, so it guesses — and it guesses wrong.
 * `text-caption` (a SIZE) looks exactly like `text-primary` (a COLOR) to it, so in
 * `cn("text-caption", "text-text-secondary")` it treated them as conflicting colours and
 * silently DROPPED the size. The element then fell back to the inherited 16px.
 *
 * That failed silently everywhere our scales meet a colour in the same cn(). Declaring the
 * scales here is the fix: font-size and radius are told what they are, once.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption", "micro", "label", "body", "title"] }],
      rounded: [{ rounded: ["chip", "control", "tile", "card", "modal"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
