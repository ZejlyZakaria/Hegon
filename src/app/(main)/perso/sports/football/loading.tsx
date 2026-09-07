import {
  FootballUpcomingSkeleton,
  FootballRecentResultsSkeleton,
  FootballStandingsSkeleton,
} from "@/modules/sports/components/SportSkeletons";

// TRACEABILITY (2026-09-07, chantier d'audit phase 1) — deux squelettes FANTÔMES retirés d'ici :
//   · FootballHeroSkeleton   → le héros a été supprimé en août (les fichiers `hero/*` sont morts).
//   · FootballBestXISkeleton → le Best XI a été déparqué de la page, puis supprimé.
// Ils dessinaient à chaque chargement deux blocs qui n'arrivaient jamais : la page promettait une
// hauteur qu'elle ne tenait pas, donc un saut de mise en page à chaque visite.
//
// ⚠️ Un squelette doit avoir EXACTEMENT la forme de ce qui le remplace. Le vérifier est un axe de
// l'audit par module (axe 6, « fidélité de forme + colocation »).
//
// ⏳ MANQUE : `FollowingStrip` (la première section de la page) n'a plus de squelette du tout —
// l'ancien `FootballHeroSkeleton` n'avait pas sa forme (héros de 72px avec grosse pastille, alors que
// la section est une bande de cartes de 44px avec en-tête). Mieux vaut aucun squelette qu'un faux,
// mais il faudra en écrire un vrai lors de la passe UI/UX du module.
export default function FootballLoading() {
  return (
    <div className="p-6 space-y-4">
      <FootballUpcomingSkeleton />
      <FootballRecentResultsSkeleton />
      <FootballStandingsSkeleton />
    </div>
  );
}
