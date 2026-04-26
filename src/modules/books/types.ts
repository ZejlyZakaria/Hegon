// =====================================================
// DATABASE TYPES
// =====================================================

export type BookStatus = 'want_to_read' | 'reading' | 'read' | 'abandoned' | 'paused';

export interface Book {
  id:           string;
  org_id:       string;
  user_id:      string;

  // Metadata
  title:        string;
  author:       string | null;
  cover_url:    string | null;
  external_id:  string | null;   // Google Books volume ID
  year:         number | null;
  genre:        string[];
  total_pages:  number | null;
  description:  string | null;

  // Personal tracking
  status:       BookStatus;
  current_page: number;
  rating:       number | null;   // 1–5
  notes:        string | null;
  highlights:   string[];
  favorite:     boolean;
  started_at:   string | null;
  finished_at:  string | null;
  created_at:   string;
  updated_at:   string;

  // Cross-module connections
  goal_id:      string | null;
}

// =====================================================
// API INPUT TYPES
// =====================================================

export interface CreateBookInput {
  title:        string;
  author?:      string | null;
  cover_url?:   string | null;
  external_id?: string | null;
  year?:        number | null;
  genre?:       string[];
  total_pages?: number | null;
  description?: string | null;
  status?:      BookStatus;
  goal_id?:     string | null;
}

export interface UpdateBookInput {
  id:           string;
  title?:       string;
  author?:      string | null;
  cover_url?:   string | null;
  year?:        number | null;
  genre?:       string[];
  total_pages?: number | null;
  description?: string | null;
  status?:      BookStatus;
  current_page?: number;
  rating?:      number | null;
  notes?:       string | null;
  highlights?:  string[];
  favorite?:    boolean;
  started_at?:  string | null;
  finished_at?: string | null;
  goal_id?:     string | null;
}

export interface UpdateProgressInput {
  id:           string;
  current_page: number;
}

// =====================================================
// GOOGLE BOOKS API TYPES
// =====================================================

export interface GoogleBooksVolume {
  id:         string;
  volumeInfo: {
    title:          string;
    authors?:       string[];
    description?:   string;
    publishedDate?: string;
    pageCount?:     number;
    categories?:    string[];
    imageLinks?: {
      thumbnail?:      string;
      smallThumbnail?: string;
    };
  };
}

// Normalized shape returned by /api/books/search
export interface BookSearchResult {
  external_id:  string;
  title:        string;
  author:       string | null;
  cover_url:    string | null;
  year:         number | null;
  genre:        string[];
  total_pages:  number | null;
  description:  string | null;
}

// =====================================================
// UI TYPES
// =====================================================

export type BookTab    = 'reading' | 'want_to_read' | 'completed' | 'all';
export type BookSort   = 'recently_added' | 'rating' | 'title' | 'most_read';
export type BookFilter = 'all' | 'favorite';

// Stats zone (4 metrics)
export interface BookStats {
  total:               number;
  reading:             number;
  completed_this_year: number;
  want_to_read:        number;
  avg_rating:          number | null;
}

// Right panel data
export interface ReadingStreak {
  current: number;
  best:    number;
}

export interface BooksRightPanelData {
  streak:            ReadingStreak;
  pages_this_month:  number;
  recently_finished: Book[];      // last 3 books with status 'read'
  activityLast7:     boolean[];   // true = had book activity that day (Mon→Sun order, last 7 days)
}
