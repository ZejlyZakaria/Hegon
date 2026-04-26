import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as BooksService from "../service";
import { BOOK_KEYS } from "./query-keys";
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
  search?: string;
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
    },
    onError: () => {
      toast.error("Failed to update progress.");
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
      toast.success("Book removed.");
    },
    onError: () => {
      toast.error("Failed to remove book.");
    },
  });
}
