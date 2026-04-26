"use client";

import { ErrorBoundary } from "react-error-boundary";
import { BooksPage } from "@/modules/books/components/BooksPage";

function BooksError() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
      Something went wrong loading your books.
    </div>
  );
}

export default function BooksRoute() {
  return (
    <ErrorBoundary FallbackComponent={BooksError} onReset={() => window.location.reload()}>
      <BooksPage />
    </ErrorBoundary>
  );
}
