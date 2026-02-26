/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils"; // Ta util pour Tailwind

// Components (on les crée après)
import Widget from "@/components/dashboard/Widget";
import AddItemForm from "@/components/dashboard/AddItemForm";
// import ItemCard from '@/components/ItemCard';
import Modal from "@/components/dashboard/Modal";

// Thèmes exemples (étends avec tes idées)
const themes = {
  default: "bg-gray-900 text-white",
  watching: "bg-black text-red-300", // Vibe ciné
  tech: "bg-blue-950 text-cyan-300", // Futuriste
  // Ajoute books: 'bg-amber-950 text-amber-200', sport: 'bg-green-950 text-lime-300', etc.
} as const;

type ThemeKey = keyof typeof themes;

export default function Dashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  // const [currentCategory, setCurrentCategory] = useState<ThemeKey>('default'); // Switch via sidebar
  const [currentCategory] = useState<ThemeKey>("default"); // Switch via sidebar
  const [widgetsOrder, setWidgetsOrder] = useState([
    "watchlist",
    "goals",
    "tech",
  ]); // Pour drag/drop
  const router = useRouter();

  const editInitialValues = useMemo(() => {
    if (!editingItem) return null; // ou un objet vide par défaut

    return {
      title: editingItem.title || "",
      description: editingItem.description || "",
      category: editingItem.category || "films",
      tags: editingItem.tags?.join(", ") || "",
      due_date: editingItem.due_date || "",
      rating: editingItem.rating || "",
      poster_url: editingItem.poster_url || "",
    };
  }, [editingItem]);

  const refreshItems = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", session.user.id);
    setItems(data || []);
  };

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.push("/auth");
      refreshItems();
    };
    checkSession();
  }, [router]);

  // const handleEditClick = (item: any) => setEditingItem(item);

  // Drag/drop handler (simplifié)
  const moveWidget = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...widgetsOrder];
    const [dragged] = newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, dragged);
    setWidgetsOrder(newOrder);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={cn("flex min-h-screen", themes[currentCategory])}>
        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-7xl mx-auto"
          >
            <h1 className="text-4xl font-bold mb-8">
              Bienvenue dans ton Digital Second Brain, Zakaria !
            </h1>

            {/* Widgets drag/drop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {widgetsOrder.map((widgetId, index) => (
                <Widget
                  key={widgetId}
                  id={widgetId}
                  index={index}
                  moveWidget={moveWidget}
                  items={items.filter((item) => item.category === widgetId)} // Filter par catégorie
                  onAdd={refreshItems} // Ou handler spécifique
                />
              ))}
            </div>
          </motion.div>
        </main>

        {/* Modal edit */}
        {editingItem && (
          <Modal
            isOpen={!!editingItem}
            onClose={() => setEditingItem(null)}
            title="Modifier"
          >
            <AddItemForm
              initialValues={editInitialValues!}
              onSubmit={async (data) => {
                const tagsArray = (data.tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t);

                const updateData = {
                  title: data.title,
                  description: data.description || null,
                  category: data.category || null,
                  tags: tagsArray.length ? tagsArray : null,
                  due_date: data.due_date || null,
                  rating: data.rating || null,
                  poster_url: data.poster_url || null,
                };

                const { error } = await supabase
                  .from("items")
                  .update(updateData)
                  .eq("id", editingItem.id);

                if (error) {
                  console.error(error);
                  alert("Erreur lors de la mise à jour");
                  return;
                }

                setEditingItem(null);
                refreshItems();
              }}
              onCancel={() => setEditingItem(null)}
              isEdit
            />
          </Modal>
        )}
      </div>
    </DndProvider>
  );
}
