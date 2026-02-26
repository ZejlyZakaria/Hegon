/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDrag, useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
// import { useRef } from 'react';
import ItemCard from './ItemCard';

const ItemType = 'WIDGET';

type WidgetProps = { id: string; index: number; moveWidget: (drag: number, hover: number) => void; items: any[]; onAdd: () => void };

export default function Widget({ id, index, moveWidget, items, onAdd }: WidgetProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemType,
    item: { index },
    collect: monitor => ({ isDragging: !!monitor.isDragging() }),
  }));

  const [, drop] = useDrop(() => ({
    accept: ItemType,
    hover: (item: { index: number }) => {
      if (item.index !== index) moveWidget(item.index, index);
      item.index = index;
    },
  }));

  // const ref = useRef<HTMLDivElement>(null);

  return (
    <motion.div 
      ref={(node) => { drag(drop(node)); }}
      className="bg-white/8 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg cursor-move"
      style={{ opacity: isDragging ? 0.5 : 1 }}
      whileHover={{ scale: 1.02 }}
    >
      <h2 className="text-xl font-semibold mb-4 capitalize">{id}</h2>
      <div className="space-y-3">
        {items.slice(0, 3).map(item => <ItemCard key={item.id} item={item} onRefresh={onAdd} onEditClick={() => {}} />)}
      </div>
      <button onClick={onAdd} className="mt-4 bg-white/10 px-4 py-2 rounded-full">Ajouter +</button>
    </motion.div>
  );
}