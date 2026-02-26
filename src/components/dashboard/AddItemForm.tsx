/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { useState, useEffect } from 'react';
import ClientOnly from '../ClientOnly';

type ItemFormData = {
  title: string;
  description?: string;
  category?: string;
  tags?: string;
  due_date?: string;
  rating?: number | '';
  poster_url?: string;
};

type AddItemFormProps = {
  initialValues?: ItemFormData;     // pour l'édition
  onSubmit: (data: ItemFormData) => Promise<void>;
  onCancel?: () => void;            // pour fermer modal en edit
  isEdit?: boolean;
};

export default function AddItemForm({
  initialValues = { title: '', description: '', category: 'films', tags: '', due_date: '', rating: '' },
  onSubmit,
  onCancel,
  isEdit = false,
}: AddItemFormProps) {
  const [formData, setFormData] = useState<ItemFormData>(initialValues);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const categories = ['films', 'séries', 'animes', 'tech', 'goals', 'autre'];


  // Recherche TMDB quand on tape (debounce simple)
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&language=fr-FR`
        );
        const data = await res.json();
        setSearchResults(data.results?.slice(0, 8) || []); // top 8 résultats
      } catch (err) {
        console.error('TMDB error:', err);
      }
      setLoadingSearch(false);
    }, 500); // debounce 500ms

    return () => clearTimeout(timer);
  }, [searchQuery]);


  const selectResult = (result: any) => {
    const isTv = result.media_type === 'tv';
    const isAnime = result.genre_ids?.includes(16) && result.origin_country?.includes('JP'); // anime = animation + origine Japon

    let detectedCategory = 'films';

    if (isTv) {
      detectedCategory = isAnime ? 'animes' : 'séries';
    } else if (result.media_type === 'movie') {
      detectedCategory = 'films';
    }

    setFormData(prev => ({
      ...prev,
      title: result.title || result.name || '',
      description: result.overview || '',
      category: detectedCategory,
      due_date: result.release_date || result.first_air_date || '',
      poster_url: result.poster_path
        ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
        : '',
    }));

    setSearchQuery('');
    setSearchResults([]);
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    await onSubmit(formData);
    if (!isEdit) {
      setFormData({ title: '', description: '', category: 'films', tags: '', due_date: '', rating: '', poster_url: '' });
    }
  };

  return (
    <ClientOnly fallback={<div className="h-32 bg-gray-800 rounded animate-pulse" />}>
    <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg mb-8 space-y-4">
      <h2 className="text-xl font-semibold mb-4">{isEdit ? 'Modifier l’item' : 'Ajouter un item'}</h2>

        {/* Champ recherche TMDB */}
      <div className="relative">
        <label className="block mb-1">Recherche film/série/anime (TMDB)</label>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          placeholder="Tape un titre (ex: One Piece, Inception...)"
        />

        {loadingSearch && <p className="text-sm text-gray-400 mt-1">Recherche en cours...</p>}

        {searchResults.length > 0 && (
          <ul className="absolute z-10 w-full bg-gray-700 border border-gray-600 rounded mt-1 max-h-60 overflow-y-auto">
            {searchResults.map((res: any) => (
              <li
                key={res.id}
                onClick={() => selectResult(res)}
                className="p-2 hover:bg-gray-600 cursor-pointer flex items-center gap-3"
              >
                {res.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${res.poster_path}`}
                    alt={res.title || res.name}
                    className="w-12 h-auto rounded"
                  />
                ) : (
                  <div className="w-12 h-16 bg-gray-500 rounded flex items-center justify-center text-xs">No img</div>
                )}
                <div>
                  <div className="font-medium">{res.title || res.name}</div>
                  <div className="text-sm text-gray-400">
                    {res.media_type.toUpperCase()} • {res.release_date || res.first_air_date || 'N/A'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label className="block mb-1">Titre *</label>
        <input
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          required
        />
      </div>

      <div>
        <label className="block mb-1">Catégorie</label>
        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1">Description</label>
        <textarea
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white h-24"
        />
      </div>

      <div>
        <label className="block mb-1">Tags (séparés par virgule)</label>
        <input
          name="tags"
          type="text"
          value={formData.tags || ''}
          onChange={handleChange}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          placeholder="ex: action, 2023, must-watch"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-1">Date limite (to-do)</label>
          <input
            name="due_date"
            type="date"
            value={formData.due_date || ''}
            onChange={handleChange}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          />
        </div>

        <div>
          <label className="block mb-1">Note (1-10)</label>
          <input
            name="rating"
            type="number"
            min="1"
            max="10"
            value={formData.rating}
            onChange={e => setFormData(prev => ({ ...prev, rating: e.target.value ? Number(e.target.value) : '' }))}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          />
        </div>
      </div>


      {/* Affichage preview poster si existant */}
      {formData.poster_url && (
        <div className="mt-4">
          <label className="block mb-1">Poster (de TMDB)</label>
          <img src={formData.poster_url} alt="Poster" className="max-h-64 rounded" />
        </div>
      )}

      <div className="flex gap-4 mt-6">
        <button
          type="submit"
          className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-medium"
        >
          {isEdit ? 'Enregistrer les modifications' : 'Ajouter à ma collection'}
        </button>

        {isEdit && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded font-medium"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
    </ClientOnly>
  );
}