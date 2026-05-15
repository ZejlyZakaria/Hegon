export interface OrgInvitation {
  id: string;
  org_id: string;
  invited_by: string;
  email: string;
  token: string;
  role: "admin" | "member" | "viewer";
  expires_at: string;
  used_at: string | null;
  created_at: string;
  org?: { name: string; slug: string };
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
  profile?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}
