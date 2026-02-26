"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "./Modal";

type Item = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  due_date?: string;
  rating?: number;
  // ajoute d'autres champs si besoin
};

type ItemCardProps = {
  item: Item;
  onRefresh: () => void;
  onEditClick: (item: Item) => void;
};

export default function ItemCard({
  item,
  onRefresh,
  onEditClick,
}: ItemCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) {
      console.error(error);
      alert("Erreur suppression");
    } else {
      onRefresh();
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="bg-gray-800 p-5 rounded-lg shadow-md border border-gray-700 hover:border-gray-500 transition-all">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold">{item.title}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onEditClick(item)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Modifier
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Supprimer
          </button>
        </div>
      </div>

      {item.description && (
        <p className="text-gray-300 mb-3">{item.description}</p>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {item.category && (
          <span className="bg-gray-700 px-2 py-1 rounded">{item.category}</span>
        )}
        {item.tags?.map((tag, i) => (
          <span key={i} className="bg-gray-700 px-2 py-1 rounded">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 text-sm text-gray-400 flex justify-between">
        {item.due_date && <div>À faire avant : {item.due_date}</div>}
        {item.rating && <div>Note : {item.rating}/10</div>}
      </div>

      {/* Modal de confirmation delete */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirmer la suppression"
      >
        <p className="mb-6">
          Êtes-vous sûr de vouloir supprimer{" "}
          <strong>&quot;{item.title}&quot;</strong> ? Cette action est
          irréversible.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}
