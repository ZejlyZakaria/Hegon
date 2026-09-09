# `knip.json` — pourquoi ce fichier existe et comment le lire

`knip` détecte le code mort : il part des **points d'entrée**, suit chaque `import`, et déclare mort
tout ce qu'il n'atteint jamais.

## ⚠️ Sans cette config, knip fait supprimer de l'infrastructure vivante

Il devine les points d'entrée par convention. Il connaît Next.js. Il ne peut PAS deviner que :

- **les 20 edge functions** (`supabase/functions/*/index.ts`) sont des points d'entrée — elles sont
  appelées par des **crons, depuis la base de données**, donc rien dans le code ne pointe vers elles ;
- **les 16 scripts `.mjs`** (`scripts/`) en sont aussi — lancés à la main ou par npm ;
- `sentry.*.config.ts` est chargé par le framework, jamais importé.

Avant cette config, knip déclarait mortes ces **36 entrées**. Les supprimer aurait cassé toute
l'alimentation automatique de HEGON.

⭐ **La config est courte, et c'est voulu.** Le fichier ne liste QUE ce que knip ne sait pas deviner.
La première version listait aussi l'App Router, `middleware.ts`, `instrumentation*.ts`, `next.config`,
`vitest.config`, `postcss.config`, `eslint.config` — knip a lui-même répondu *« redundant entry
pattern »* pour chacune : ses plugins les connaissent déjà. Une config qui répète le tool est du bruit
qui finira par mentir. **Si tu ajoutes une entrée, vérifie d'abord que knip ne la connaît pas** : lance
`npm run knip` et lis la section « Configuration hints », il te le dit.

## Les deux commandes

```bash
npm run knip      # rapport complet — fichiers, exports, dépendances
npm run knip:ci   # le CLIQUET : échoue uniquement sur les catégories non ambiguës
```

**Pourquoi le cliquet ne regarde PAS les exports inutilisés.** Un fichier orphelin ou une dépendance
jamais chargée, c'est un fait. Un *export* inutilisé, souvent non : les primitifs vendorisés de
`shared/components/ui/` exposent l'API complète du composant (`DialogClose`, `PopoverAnchor`,
`SelectGroup`…), et `npx shadcn add` les réécrirait de toute façon. Faire échouer le build là-dessus
rendrait le cliquet insupportable — et **un cliquet qu'on désactive ne protège rien**. Les exports
restent donc visibles dans `npm run knip`, en information, à trier à la main.

## Ce qui est délibérément ignoré

| Entrée | Pourquoi |
|---|---|
| `shadcn` | CLI lancée à la main (`npx shadcn add`), jamais importée |
| `tailwindcss`, `tw-animate-css` | chargées par PostCSS/CSS, pas par un `import` |
| `lint-staged` | lancé par le hook git `.husky/pre-commit`, jamais importé |
| `playwright` | ⚠️ voir ci-dessous — utilisé **uniquement** par des scripts gitignorés |

## ⚠️⚠️ LE PIÈGE QUI A FAIT ÉCHOUER LA CI (2026-09-09)

**La CI ne voit pas le même dépôt que ton disque.** Tout ce qui est gitignoré est **invisible** pour
elle. `knip:ci` passait en local et **échouait en CI** — pendant deux commits.

La cause : `playwright` n'est utilisé que par `scripts/shoot.mjs` et `scripts/auth-setup.mjs`, le
harnais de capture d'écran **gitignoré à dessein** (« local-only dev tooling »). Sur le poste, knip voit
ses utilisateurs ; en CI, ces fichiers n'existent pas, donc la dépendance paraît orpheline et le cliquet
casse le build.

⭐ **La leçon de méthode, plus importante que le correctif** : vérifier un cliquet en local **n'est pas
une preuve**, parce qu'on l'exécute dans un environnement qui n'est pas le sien. La preuve, c'est de
**cloner le dépôt dans un dossier propre** — le clone ne contient que ce qui est versionné, exactement
comme un checkout de CI :

```bash
git clone . /tmp/ci-sim && cd /tmp/ci-sim
npm ci && npm run knip:ci && npm run test && npm run build
```

**À faire avant de toucher à `knip.json`, à `ci.yml`, ou à quoi que ce soit qui dépend de la liste des
fichiers.** Autres pièges de la même famille dans ce projet : `src/app/(main)/icon-lab/`,
`src/shared/components/app-icon/`, `hq/`, `memory/`, `CLAUDE.md` — tous gitignorés, tous invisibles à
la CI.

## À savoir en le modifiant

`ignoreExportsUsedInFile: true` évite de signaler un export utilisé uniquement dans son propre
fichier — sinon chaque helper interne exporté pour les tests remonterait.

Et si knip signale un jour un fichier que tu crois vivant : **vérifie avec `grep` avant de supprimer**.
La migration `20260809_football_drop_widget_tables.sql` affirmait par écrit que deux fonctions dashboard
étaient « jamais appelées » — c'était faux, elles l'étaient, et le bug a vécu 28 jours.
