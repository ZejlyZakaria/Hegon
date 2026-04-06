"use client";

import { ErrorFallback } from "@/shared/components/ui/ErrorFallback";

export default function F1Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} />;
}
