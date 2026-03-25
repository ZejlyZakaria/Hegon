"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Team {
  id: string;
  name: string;
  crest_url: string | null;
}

interface FootballRemoveConfirmModalProps {
  open: boolean;
  team: Team | null;
  onClose: () => void;
  onConfirm: (teamId: string) => Promise<void>;
}

export default function FootballRemoveConfirmModal({
  open,
  team,
  onClose,
  onConfirm,
}: FootballRemoveConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!team) return;
    setLoading(true);
    try {
      await onConfirm(team.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && team && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            className="fixed inset-x-4 top-[30%] z-50 mx-auto max-w-sm"
          >
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-zinc-800/60">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Shield size={15} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Retirer des favoris
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Cette action est réversible
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="px-5 py-4 flex items-center gap-4">
                <div>
                  <p className="text-white font-semibold text-sm">
                    {team.name}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Retirer cette équipe de tes favoris ?
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={loading}
                  className="border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                >
                  {loading ? (
                    <Loader2 size={13} className="animate-spin mr-1.5" />
                  ) : null}
                  Retirer
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
