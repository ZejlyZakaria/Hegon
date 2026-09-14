// Cliquet R10, côté CI : une MIGRATION sans mise à jour de la RÉFÉRENCE du schéma ne passe pas.
//
// Pourquoi ce script existe (2026-09-14) : Watching v4 a poussé deux migrations versionnées
// (`episode_highlights` ±2 colonnes, `for_you_dismissals`) sans toucher
// `supabase/checks/expected-objects.json`. Le watchdog a fait son travail — DÉRIVE sur 4 lignes —
// mais pour une dérive qui n'en était pas une : le schéma était juste, c'est la référence qui
// avait pris du retard. Une règle écrite dans un `_comment` (« le commit qui touche ce fichier
// doit contenir la migration ») n'est pas un mécanisme. Celui-ci en est un : la référence porte
// `_migrations_through` = la dernière migration qu'elle couvre ; si `supabase/migrations/` en
// contient une plus récente, la CI est rouge, avec la marche à suivre.
//
// Zéro dépendance, zéro accès base : compare deux chaînes.

import { readdirSync, readFileSync } from "node:fs";

const REF = "supabase/checks/expected-objects.json";
const ref = JSON.parse(readFileSync(REF, "utf8"));
const through = String(ref._migrations_through ?? "");

const latest = readdirSync("supabase/migrations")
  .filter((f) => /^\d{14}_.*\.sql$/.test(f))
  .sort()
  .at(-1);

if (!latest) {
  console.error("check-schema-reference: aucune migration trouvée dans supabase/migrations/ — anormal.");
  process.exit(1);
}
const latestStamp = latest.slice(0, 14);

if (!/^\d{14}$/.test(through)) {
  console.error(`check-schema-reference: ${REF} n'a pas de champ "_migrations_through" (horodatage 14 chiffres).`);
  process.exit(1);
}

if (latestStamp > through) {
  console.error(
    [
      `check-schema-reference: la migration ${latest} est plus récente que la référence du schéma`,
      `(_migrations_through = ${through}).`,
      "",
      "La référence n'a pas suivi. Marche à suivre, dans le MÊME commit que la migration :",
      "  1. appliquer la migration : npx supabase db push --linked",
      "  2. relever les comptages réels : psql \"$DB_URL\" -f supabase/checks/schema-drift.sql",
      "     (ou lancer le watchdog à la main et lire l'étape « Dérive du schéma »)",
      `  3. reporter tables / colonnes / policies / fonctions / index / crons dans ${REF}`,
      `  4. mettre "_migrations_through": "${latestStamp}"`,
      "",
      "Ne pas mettre à jour les chiffres sans migration : c'est le garde qu'on ferait taire.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`check-schema-reference: référence à jour (jusqu'à ${through}, dernière migration ${latestStamp}).`);
