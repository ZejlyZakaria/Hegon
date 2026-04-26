"use client";

import { BookOpen } from "lucide-react";

interface BooksEmptyStateProps {
  title?: string;
  message?: string;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export function BooksEmptyState({
  title = "No books yet",
  message = "Start building your reading library",
  showAddButton = false,
  onAddClick,
}: BooksEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {/* Icon */}
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)' }}
      >
        <BookOpen 
          className="w-8 h-8" 
          style={{ color: '#0ea5e9' }}
        />
      </div>

      {/* Text */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-lg font-semibold text-text-primary">
          {title}
        </h3>
        <p className="text-sm text-text-tertiary max-w-md">
          {message}
        </p>
      </div>

      {/* CTA Button */}
      {showAddButton && onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-2 h-8 px-3 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0ea5e9' }}
        >
          Add Your First Book
        </button>
      )}
    </div>
  );
}