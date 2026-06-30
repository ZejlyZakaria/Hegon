import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as BooksService from "../service";
import { BOOK_KEYS } from "./query-keys";
import { toast } from "@/shared/utils/toast";
import { useIsDemo } from "@/modules/settings/hooks/useSettings";
import { DemoReadOnlyError, handledDemoError } from "@/shared/utils/demo-guard";
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
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (vars: { id: string; favorite: boolean; bookId: string }) => {
      if (isDemo) throw new DemoReadOnlyError();
      return BooksService.updateQuote({ id: vars.id, favorite: vars.favorite });
    },
    onSuccess: (_data, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
    },
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to update quote."); },
  });
}

// =====================================================
// MUTATIONS
// =====================================================

export function useCreateQuote(bookId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: CreateQuoteInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return BooksService.createQuote(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
    },
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to add quote."); },
  });
}

export function useUpdateQuote(bookId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (input: UpdateQuoteInput) => {
      if (isDemo) throw new DemoReadOnlyError();
      return BooksService.updateQuote(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
    },
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to update quote."); },
  });
}

export function useDeleteQuote(bookId: string) {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  return useMutation({
    mutationFn: (id: string) => {
      if (isDemo) throw new DemoReadOnlyError();
      return BooksService.deleteQuote(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.quotes(bookId) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.allQuotes() });
    },
    onError: (error) => { if (handledDemoError(error)) return; toast.error("Failed to delete quote."); },
  });
}
