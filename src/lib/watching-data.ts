export type Category = "movies" | "tvshows" | "anime";

export type WatchItem = {
  id: string;
  type: "film" | "serie" | "anime";
  title: string;
  original_title: string;
  description: string;
  poster_url: string;
  backdrop_url: string;
  year: number;
  runtime: number | null;
  episode_runtime?: number;
  seasons?: number;
  episodes?: number;
  current_episode?: number;
  rating: number;
  user_rating: number;
  watched: boolean;
  want_to_watch: boolean;
  favorite: boolean;
  watched_at: string | null;
  priority: number;
  tmdb_id: number;
  notes: string;
  tags: string[];
  directors?: { name: string; profile_url?: string }[]; // plusieurs réalisateurs possibles
  studio?: string; // compagnie principale
  status?: "ended" | "ongoing"; 
  created_at: string;
};

export const genreColors: Record<string, string> = {
  "Sci-Fi": "bg-cyan-500/15 text-cyan-400",
  Thriller: "bg-amber-500/15 text-amber-400",
  Noir: "bg-zinc-500/15 text-zinc-300",
  Fantasy: "bg-emerald-500/15 text-emerald-400",
  Adventure: "bg-lime-500/15 text-lime-400",
  Mecha: "bg-red-500/15 text-red-400",
  Action: "bg-orange-500/15 text-orange-400",
  Drama: "bg-blue-500/15 text-blue-400",
  Psychological: "bg-indigo-500/15 text-indigo-400",
  War: "bg-stone-500/15 text-stone-300",
  "Slice of Life": "bg-pink-500/15 text-pink-400",
  Romance: "bg-rose-500/15 text-rose-400",
  Horror: "bg-red-500/15 text-red-400",
  Mystery: "bg-violet-500/15 text-violet-400",
  Crime: "bg-amber-500/15 text-amber-400",
  "Dark Fantasy": "bg-indigo-500/15 text-indigo-400",
};

// AI recommendations mock data
export interface AIRecommendation {
  id: string;
  title: string;
  poster: string;
  year: number;
  rating: number;
  genres: string[];
  reason: string;
}

export const aiRecommendations: AIRecommendation[] = [
  {
    id: "r1",
    title: "Arrival",
    poster: "/posters/glass-memory.jpg",
    year: 2016,
    rating: 7.9,
    genres: ["Sci-Fi", "Drama"],
    reason: "You loved Nexus Protocol",
  },
  {
    id: "r2",
    title: "Blade Runner 2049",
    poster: "/posters/night-shift.jpg",
    year: 2017,
    rating: 8.0,
    genres: ["Sci-Fi", "Thriller"],
    reason: "Matches your Sci-Fi taste",
  },
  {
    id: "r3",
    title: "Dark",
    poster: "/posters/the-hollow.jpg",
    year: 2017,
    rating: 8.8,
    genres: ["Thriller", "Mystery"],
    reason: "You rated Shadow District 8/10",
  },
  {
    id: "r4",
    title: "Attack on Titan",
    poster: "/posters/void-walker.jpg",
    year: 2013,
    rating: 9.0,
    genres: ["Action", "Dark Fantasy"],
    reason: "Similar to Steel Horizon",
  },
  {
    id: "r5",
    title: "Severance",
    poster: "/posters/crimson-tide.jpg",
    year: 2022,
    rating: 8.7,
    genres: ["Thriller", "Drama"],
    reason: "Based on your top genres",
  },
  {
    id: "r6",
    title: "Dune: Part Two",
    poster: "/posters/last-kingdom.jpg",
    year: 2024,
    rating: 8.6,
    genres: ["Sci-Fi", "Adventure"],
    reason: "You enjoyed The Last Kingdom",
  },
];
