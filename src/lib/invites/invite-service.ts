import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceRole, setCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { revalidatePath } from "next/cache";
import { APP_URL } from "@/lib/constants";

export async function createInvite(email: string, role: "member" | "viewer" | "admin") {
  await requireWorkspaceRole(["owner", "admin"]);
  const workspace = await requireWorkspaceRole(["owner", "admin"]);
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const supabase = createClient();

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("user_id")
    .single();

  if (existingMember) {
    throw new Error("User is already a member of this workspace");
  }

  // Check for existing pending invite
  const { data: existingInvite } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("email", email)
    .is("accepted_at", null)
    .single();

  if (existingInvite) {
    throw new Error("An invitation has already been sent to this email");
  }

  // Create invite
  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspace.id,
      email,
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Generate invite URL
  const inviteUrl = `${APP_URL}/invite/${invite.token}`;

  // In development, log the invite URL
  if (process.env.NODE_ENV === "development") {
    console.log(`\n===== INVITE LINK =====`);
    console.log(`Workspace: ${workspace.name}`);
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log(`Invite URL: ${inviteUrl}`);
    console.log(`======================\n`);
  }

  revalidatePath("/settings/invites");

  return { invite, inviteUrl };
}

export async function getInvite(token: string) {
  const supabase = createClient();

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .select(`
      *,
      workspace:workspaces(id, name)
    `)
    .eq("token", token)
    .single();

  if (error || !invite) {
    return null;
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    return { ...invite, expired: true };
  }

  return { ...invite, expired: false };
}

export async function acceptInvite(token: string) {
  const supabase = createClient();
  const user = await getCurrentUser();

  if (!user) {
