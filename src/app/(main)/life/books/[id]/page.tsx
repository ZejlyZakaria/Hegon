"use client";

import { use } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { BookDetailPage } from "@/modules/books/components/BookDetailPage";

function BookDetailError() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
      Something went wrong loading this book.
    </div>
  );
}

export default function BookDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ErrorBoundary FallbackComponent={BookDetailError}>
      <BookDetailPage id={id} />
    </ErrorBoundary>
  );
}
