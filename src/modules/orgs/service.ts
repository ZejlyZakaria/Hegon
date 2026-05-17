import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type { OrgInvitation, OrgMember } from "./types";

export async function getOrgMembers(): Promise<OrgMember[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data: members, error } = await supabase
    .from("memberships")
    .select("org_id, user_id, role, created_at")
    .eq("org_id", orgId);

  if (error) throw error;
  if (!members || members.length === 0) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return members.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id) ?? null,
  }));
}

export async function getOrgInfo() {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, plan")
    .eq("id", orgId)
    .single();

  if (error) throw error;
  return data;
}

export async function createInvitation(email: string): Promise<OrgInvitation> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("org_invitations")
    .insert({
      org_id: orgId,
      invited_by: user.id,
      email: email.trim().toLowerCase(),
      role: "member",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrgInvitations(): Promise<OrgInvitation[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("org_invitations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("org_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) throw error;
}

export async function getInvitationByToken(token: string): Promise<OrgInvitation | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });

  if (error) throw error;
  return (data as OrgInvitation | null) ?? null;
}

export async function acceptInvitation(token: string): Promise<{ success: boolean; org_id: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
