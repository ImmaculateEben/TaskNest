import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getCurrentWorkspace() {
  const cookieStore = cookies();
  const workspaceId = cookieStore.get("current_workspace_id")?.value;

  if (!workspaceId) {
    return null;
  }

  const supabase = createClient();

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (error || !workspace) {
    return null;
  }

  // Get user's role in this workspace
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return null;
  }

  return {
    ...workspace,
    role: membership.role,
  };
}

export async function requireWorkspace(workspaceId?: string) {
  const workspace = await getCurrentWorkspace();

  if (!workspace) {
    redirect("/onboarding");
  }

  if (workspaceId && workspace.id !== workspaceId) {
    redirect(`/onboarding`);
  }

  return workspace;
}

export async function requireWorkspaceRole(allowedRoles: string[]) {
  const workspace = await getCurrentWorkspace();

  if (!workspace) {
    redirect("/onboarding");
  }

  if (!allowedRoles.includes(workspace.role)) {
    throw new Error("Insufficient permissions");
  }

  return workspace;
}

export async function getUserWorkspaces() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      created_at,
      workspaces (
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", user.id);

  if (error || !memberships) {
    return [];
  }

  return memberships.map((m) => ({
    ...m.workspaces,
    role: m.role,
    member_since: m.created_at,
  }));
}

export async function setCurrentWorkspace(workspaceId: string) {
  const cookieStore = cookies();
  cookieStore.set("current_workspace_id", workspaceId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}
