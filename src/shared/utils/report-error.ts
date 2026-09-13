import * as Sentry from "@sentry/nextjs";

/**
 * R8 — un échec silencieux est un BUG, pas une dégradation gracieuse (hq/rules/system-design.md).
 *
 * HEGON a déjà perdu 40 h de crons et 28 jours de football sur des erreurs avalées par un `catch {}`
 * qui faisait exactement son travail. La règle : on n'avale que le cosmétique (`localStorage`, un
 * log d'activité). Tout ce qui change ce que l'utilisateur voit — un compteur d'objectif qui ne
 * bouge plus, une saison absente d'une heatmap — continue de se dégrader à l'écran, MAIS remonte ici.
 *
 * Un seul point d'entrée pour que le cliquet à venir (« pas de `catch {}` hors exceptions nommées »)
 * ait quelque chose de concret à exiger : un `catch` qui appelle `reportError` n'est plus silencieux.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
