/** Follow metadata describes the actual credit, not the text shown under a face. */
export function followDepartment(role: string | null | undefined, type: string, cast: boolean): string | null {
  if (cast) return type === "anime" ? "Voice Acting" : "Acting";
  if (role === "creator") return "Creating";
  if (role === "director" || (!role && type === "film")) return "Directing";
  if (role === "production") return "Production";
  return null;
}
export type CreditRole = "director" | "creator" | "production";
export function creditRole(job: string | null | undefined, type: string): CreditRole | null {
  if (job === "Director" || job === "Series Director") return "director";
  if (type !== "film" && job === "Creator") return "creator";
  if (job === "Executive Producer" || job === "Producer") return "production";
  return null;
}
/** Legacy TV crew had no job: its directing role is unverified. */
export function isDirectorCredit(p: { role?: string | null }, type: string): boolean {
  return p.role === "director" || (type === "film" && !p.role);
}
export const creditRoleLabel = (role?: string | null) => role === "creator" ? "Creator" : role === "director" ? "Director" : "Crew";
