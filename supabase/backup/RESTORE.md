# HEGON — restaurer une sauvegarde

> Écrit pour un jour de panique. Lis dans l'ordre, ne saute rien.
> Ce fichier est copié dans `hegon-backups` à chaque sauvegarde par `.github/workflows/backup.yml`.

**Il te faut :**
- `gpg` et `gzip` — Git Bash sur Windows les a.
- **`psql` version 17.6 ou plus** — ⚠️ Git Bash ne l'a PAS, il s'installe à part (installeur PostgreSQL
  ou `winget install PostgreSQL.PostgreSQL.17`). Et pas n'importe quelle version : depuis la 17.6,
  `pg_dump` écrit une commande `\restrict` en tête de fichier que les `psql` plus anciens ne
  connaissent pas — un `psql` 16 s'arrête **avant la première ligne SQL**. Vérifie : `psql --version`.
- **la passphrase** (gestionnaire de mots de passe, ou la copie hors-ligne).
- un projet Supabase neuf.

---

## 1. Choisir la sauvegarde

Dans ce dépôt, les fichiers sont datés. Prends **la plus récente** — ou la dernière d'avant l'incident :

```
2026-09-14.data.sql.gz.gpg     ← les données (l'irremplaçable)
2026-09-14.schema.sql.gz.gpg   ← le schéma tel qu'il était ce jour-là
```

## 2. Déchiffrer et décompresser

```bash
gpg --decrypt 2026-09-14.schema.sql.gz.gpg | gunzip > schema.sql
gpg --decrypt 2026-09-14.data.sql.gz.gpg   | gunzip > data.sql
```

**`gpg` ouvre une petite fenêtre grise qui demande la passphrase — c'est normal**, ce n'est pas une
erreur ni un virus, c'est son programme de saisie (« pinentry »). Tape la passphrase dedans, deux fois
(une par fichier). **Vérifie tout de suite** que ce n'est pas vide :

```bash
ls -lh schema.sql data.sql          # data.sql doit peser ~15 Mo ou plus
grep -c '^INSERT INTO ' data.sql    # plusieurs milliers
```

## 3. Créer un projet Supabase neuf

Dashboard Supabase → New project. Récupère la chaîne de connexion :
**Project Settings → Database → Connection string → onglet "Session pooler"** (IPv4).

## 4. Restaurer — dans cet ordre, l'ordre n'est pas négociable

**a. Les rôles** (3 réglages, ils ne changent jamais) :

```bash
psql "<CONNECTION_STRING>" -c "ALTER ROLE anon SET statement_timeout TO '3s';" \
                          -c "ALTER ROLE authenticated SET statement_timeout TO '8s';" \
                          -c "ALTER ROLE authenticator SET statement_timeout TO '8s';"
```

**b. Le schéma :**

```bash
psql "<CONNECTION_STRING>" -v ON_ERROR_STOP=1 -f schema.sql
```

**c. Les données — avec les contraintes désactivées.** ⚠️ `tasks` et `goals` ont des clés
étrangères circulaires (une tâche pointe vers sa tâche parente) : rejouer `data.sql` tel quel
**échoue**. D'où le `session_replication_role = replica`, qui désactive les déclencheurs de clés
étrangères le temps du chargement. C'est la seule difficulté.

```bash
psql "<CONNECTION_STRING>" -v ON_ERROR_STOP=1 \
  -c "SET session_replication_role = replica;" \
  -f data.sql \
  -c "SET session_replication_role = DEFAULT;"
```

Si ça pose problème, en deux temps dans une session `psql` ouverte :

```sql
SET session_replication_role = replica;
\i data.sql
SET session_replication_role = DEFAULT;
```

## 5. Vérifier que tout y est

```sql
select count(*) from auth.users;                    -- au moins 1 : ton compte
select count(*) from public.journal_entries;
select count(*) from watching.media_items;
select count(*) from public.habit_completions;
```

Le message de commit de la sauvegarde donne le total attendu (`… N tables, M rows …`) :

```bash
git log -1 --format=%s -- 2026-09-14.data.sql.gz.gpg
```

## 6. Rebrancher l'app — et les robots

**a. L'app.** Dans Vercel et `.env.local`, remplace `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` par ceux du nouveau projet.

**b. Les edge functions.** `supabase functions deploy`, puis leurs secrets (`HEGON_SECRET_KEY`,
`FOOTBALL_DATA_KEY`, `TMDB_API_KEY`…).

**c. ⚠️ LES CRONS POINTENT ENCORE VERS L'ANCIEN PROJET.** `schema.sql` recrée les 15 crons, mais la
fonction qu'ils appellent, `internal.call_edge`, **code en dur l'URL et la clé publique de l'ancien
projet** (`femvhonlpafdajyamvcu`). Sans cette étape, les 15 crons appellent un projet mort — en
asynchrone, donc **sans aucune erreur visible**. Exactement la panne des 40 h.

Récupère la nouvelle URL et la clé `sb_publishable_…` (Project Settings → API Keys), puis :

```sql
CREATE OR REPLACE FUNCTION "internal"."call_edge"("fn" "text", "payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
  gateway_key constant text := 'sb_publishable_NOUVELLE_CLE';                -- ← à remplacer
  req_id bigint;
begin
  if fn !~ '^[a-z0-9_-]+$' then
    raise exception 'call_edge: invalid function name %', fn;
  end if;

  select net.http_post(
    url := 'https://NOUVEAU_PROJET.supabase.co/functions/v1/' || fn,      -- ← à remplacer
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || gateway_key
    ),
    body := payload,
    timeout_milliseconds := 300000
  ) into req_id;

  return req_id;
end;
$_$;
```

> C'est le corps exact de `schema.sql` (cherche `call_edge`), seules l'URL et la clé changent. Vérifie ensuite qu'un cron aboutit vraiment : `select * from net._http_response order by
> created desc limit 5;` doit montrer des `status_code` à 200 dans les heures qui suivent.

---

## Ce que cette sauvegarde ne contient PAS

- **Les fichiers des buckets Storage** (affiches uploadées à la main, avatar, fonds d'écran). Ils ne
  sont pas dans Postgres. Peu nombreux ; à re-uploader.
- **Les sessions ouvertes** (`auth.sessions`, `refresh_tokens`) — volontairement. Tu te reconnectes.
- **Les tables régénérables** sont incluses quand même (classements, matchs, tendances) : elles ne
  pèsent que ~10 % et ça évite d'attendre les crons.

## Si la passphrase est perdue

Ces fichiers sont irrécupérables. Il reste **OneDrive `hegon-backups/`** : un dump **manuel**, en
clair, fait à la main le 2026-09-09 (ou plus tard si tu l'as refait). ⚠️ **Rien ne l'alimente
automatiquement** — ce n'est pas un second emplacement, c'est une photo datée. Tu perds tout ce qui
a été écrit depuis.
