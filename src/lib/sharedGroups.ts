import { supabase } from "./supabase";
import { APP_STORE_URL } from "./mateInvite";

export type SharedGroupMember = {
  id: string;
  name: string;
  checkedIn: boolean;
};

export type SharedGroup = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  cadenceDays: number;
  inviteCode: string | null;
  members: SharedGroupMember[];
};

export type GroupPreview = {
  id: string;
  name: string;
  ownerName: string;
  cadenceDays: number;
  memberCount: number;
};

const PENDING_GROUP_KEY = "nuj.pending_group_invite";

export const normalizeGroupInvite = (value?: string | null): string | null => {
  const code = (value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{7}$/.test(code) ? code : null;
};

export const parseGroupInvite = (value: string): string | null => {
  const code = normalizeGroupInvite(value);
  if (code) return code;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname.replace(/^www\./, "") !== "nuj.social") return null;
    const match = url.pathname.match(/^\/join\/([a-z0-9]{7})\/?$/i);
    return normalizeGroupInvite(match?.[1]);
  } catch {
    return null;
  }
};

export const buildGroupInviteLink = (code: string) =>
  `https://nuj.social/join/${encodeURIComponent(code)}`;

export const buildGroupInviteMessage = (name: string, code: string) =>
  `Join our ${name} group on NUJ: ${buildGroupInviteLink(code)}\n\nGroup invite code: ${code}\n\nDon't have NUJ yet? ${APP_STORE_URL}\nAfter installing, open this link again or enter the group invite code.`;

export const savePendingGroupInvite = (code: string) => {
  const normalized = normalizeGroupInvite(code);
  if (!normalized) return;
  try {
    window.localStorage.setItem(PENDING_GROUP_KEY, normalized);
  } catch {
    return;
  }
};

export const takePendingGroupInvite = (): string | null => {
  try {
    const code = window.localStorage.getItem(PENDING_GROUP_KEY);
    window.localStorage.removeItem(PENDING_GROUP_KEY);
    return normalizeGroupInvite(code);
  } catch {
    return null;
  }
};

async function callGroupRpc<Result>(name: string, args?: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === "PGRST202") {
      throw new Error("Shared groups aren't available yet. Apply Supabase migration 034_shared_groups.sql.");
    }
    throw new Error(error.message || "Unable to update this shared group.");
  }
  return data as Result;
}

export const listSharedGroups = () => callGroupRpc<SharedGroup[]>("list_shared_groups");
export const previewSharedGroup = (code: string) =>
  callGroupRpc<GroupPreview | null>("preview_shared_group", { p_code: code });
export const createSharedGroup = (name: string, cadenceDays: number) =>
  callGroupRpc<string>("create_shared_group", { p_name: name, p_cadence: cadenceDays });
export const joinSharedGroup = (code: string) =>
  callGroupRpc<string>("join_shared_group", { p_code: code });

export type SharedGroupAction = "update" | "reset_invite" | "remove_member" | "leave" | "transfer" | "delete";

export const manageSharedGroup = (
  id: string,
  action: SharedGroupAction,
  options: { name?: string; cadenceDays?: number; memberId?: string } = {},
) => callGroupRpc<null>("manage_shared_group", {
  p_group_id: id,
  p_action: action,
  p_name: options.name ?? null,
  p_cadence: options.cadenceDays ?? null,
  p_member_id: options.memberId ?? null,
});