"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import TennisPlayerSearchModal from "./modals/TennisPlayerSearchModal";

interface TennisClientPageProps {
  userId: string;
  favoritePlayerIds: string[];
}

export default function TennisClientPage({ userId, favoritePlayerIds }: TennisClientPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex justify-end">
      <Button
        onClick={() => setModalOpen(true)}
        variant="outline"
        className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-2"
      >
        + Add a player
      </Button>

      <TennisPlayerSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
        currentFavoriteIds={favoritePlayerIds}
        onPlayerAdded={() => {
          setModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}