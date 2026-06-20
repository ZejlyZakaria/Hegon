import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as BooksService from "../service";
import { BOOK_KEYS } from "./query-keys";
import { syncBooksGoals } from "../lib/sync-goals";
import { toast } from "@/shared/utils/toast";
import type {
  BookStatus,
  BookSort,
  CreateBookInput,
  UpdateBookInput,
  UpdateProgressInput,
} from "../types";

// =====================================================
// QUERIES
// =====================================================

export function useBooks(opts?: {
  status?: BookStatus;
  favorite?: boolean;
  sort?: BookSort;
}) {
  return useQuery({
    queryKey: BOOK_KEYS.list(opts),
    queryFn:  () => BooksService.getBooks(opts),
    staleTime: 1000 * 60 * 5,
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: BOOK_KEYS.detail(id),
    queryFn:  () => BooksService.getBook(id),
    staleTime: 1000 * 60 * 5,
    enabled:  !!id,
  });
}

export function useBookStats() {
  return useQuery({
    queryKey: BOOK_KEYS.stats(),
    queryFn:  () => BooksService.getBookStats(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useBooksRightPanel() {
  return useQuery({
    queryKey: BOOK_KEYS.rightPanel(),
    queryFn:  () => BooksService.getRightPanelData(),
    staleTime: 1000 * 60 * 5,
  });
}

// Reading-log rows for the Stats "pages read" (Σ pages, in-progress books included).
export function useReadingLog(year: number | null) {
  return useQuery({
    queryKey: BOOK_KEYS.readingLog(year),
    queryFn:  () => BooksService.getReadingLog(year),
    staleTime: 1000 * 60 * 5,
  });
}

// =====================================================
// MUTATIONS
// =====================================================

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookInput) => BooksService.createBook(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.stats() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.rightPanel() });
      void syncBooksGoals(queryClient);
      toast.success("Book added.");
    },
    onError: () => {
      toast.error("Failed to add book.");
    },
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBookInput) => BooksService.updateBook(input),
    onSuccess: (book) => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.detail(book.id) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.stats() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.rightPanel() });
      queryClient.invalidateQueries({ queryKey: [...BOOK_KEYS.all, 'reading-log'] });
      void syncBooksGoals(queryClient);
      toast.success("Book updated.");
    },
    onError: () => {
      toast.error("Failed to update book.");
    },
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProgressInput) => BooksService.updateProgress(input),
    onSuccess: (book) => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.detail(book.id) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.rightPanel() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.stats() });
      queryClient.invalidateQueries({ queryKey: [...BOOK_KEYS.all, 'reading-log'] });
    },
    onError: () => {
      toast.error("Failed to update progress.");
    },
  });
}

// Silent autosave for the review/notes field — no toast, just refresh the detail.
export function useUpdateBookNotes(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string | null) => BooksService.updateBook({ id, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.detail(id) });
    },
  });
}

// Toggle a book's favorite flag — silent (no toast), just refresh the surfaces
// that show it (card, detail, Favorites stat).
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      BooksService.updateBook({ id, favorite }),
    onSuccess: (book) => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.detail(book.id) });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.stats() });
    },
    onError: () => {
      toast.error("Failed to update favorite.");
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => BooksService.deleteBook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.stats() });
      queryClient.invalidateQueries({ queryKey: BOOK_KEYS.rightPanel() });
      void syncBooksGoals(queryClient);
      toast.success("Book removed.");
    },
    onError: () => {
      toast.error("Failed to remove book.");
    },
  });
}
