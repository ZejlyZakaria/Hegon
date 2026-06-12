import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as BooksService from "../service";
import { BOOK_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import type { CreateQuoteInput, UpdateQuoteInput } from "../types";

// =====================================================
// QUERY
// =====================================================

export function useBookQuotes(bookId: string) {
  return useQuery({
    queryKey: BOOK_KEYS.quotes(bookId),
    queryFn:  () => BooksService.getBookQuotes(bookId),
    staleTime: 1000 * 60 * 5,
    enabled:  !!bookId,
  });
}

// Every quote across all books — the global Quotes Wall.
export function useAllQuotes() {
  return useQuery({
    queryKey: BOOK_KEYS.allQuotes(),
    queryFn:  () => BooksService.getAllQuotes(),
    staleTime: 1000 * 60 * 5,
  });
}

// Toggle a quote's favorite from the wall (silent).
export function useToggleQuoteFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; favorite: boolean; bookId: string }) =>
      BooksService.updateQuote({ id: vars.id, favorite: vars.favorite }),
    onSuccess: (_data, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
    },
    onError: () => toast.error("Failed to update quote."),
  });
}

// =====================================================
// MUTATIONS
// =====================================================

export function useCreateQuote(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuoteInput) => BooksService.createQuote(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
    },
    onError: () => toast.error("Failed to add quote."),
  });
}

export function useUpdateQuote(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateQuoteInput) => BooksService.updateQuote(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
    },
    onError: () => toast.error("Failed to update quote."),
  });
}

export function useDeleteQuote(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => BooksService.deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
    },
    onError: () => toast.error("Failed to delete quote."),
  });
}
