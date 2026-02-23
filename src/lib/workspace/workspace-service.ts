import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceRole, setCurrentWorkspace } from "./get-current-workspace";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { revalidatePath } from "next/cache";

export async function createWorkspace(name: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const supabase = createClient();

  // Create workspace
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      name,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Add creator as owner
  await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  // Set as current workspace
  await setCurrentWorkspace(workspace.id);

  revalidatePath("/");

  return workspace;
}

export async function updateWorkspace(workspaceId: string, name: string) {
  await requireWorkspaceRole(["owner"]);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .update({ name })
    .eq("id", workspaceId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");

  return data;
}

export async function deleteWorkspace(workspaceId: string) {
  await requireWorkspaceRole(["owner"]);
  const supabase = createClient();

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  return { success: true };
}

export async function getWorkspaceMembers(workspaceId: string) {
  await requireWorkspaceRole(["owner", "admin", "member", "viewer"]);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      created_at,
      user:profiles(id, display_name, avatar_url, email)
    `)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: "admin" | "member" | "viewer"
) {
  await requireWorkspaceRole(["owner"]);
  const supabase = createClient();

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/members");

  return { success: true };
}

export async function removeMember(workspaceId: string, userId: string) {
  await requireWorkspaceRole(["owner"]);
  const supabase = createClient();

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/members");

  return { success: true };
}

export async function seedDemoData(workspaceId: string) {
  await requireWorkspaceRole(["owner", "admin"]);
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Create tags
  const tags = [
    { name: "Frontend", color: "#6366f1" },
    { name: "Backend", color: "#22c55e" },
    { name: "Bug", color: "#ef4444" },
    { name: "Feature", color: "#8b5cf6" },
  ];

  const { data: insertedTags } = await supabase
    .from("tags")
    .insert(
      tags.map((tag) => ({
        ...tag,
        workspace_id: workspaceId,
      }))
    )
    .select();

  const tagMap = new Map(insertedTags?.map((t) => [t.name, t.id]) || []);

  // Create tasks
  const tasks = [
    {
      title: "Set up project structure",
      description: "Initialize the project with proper folder structure and configuration files",
      status: "done" as const,
      priority: "high" as const,
    },
    {
      title: "Implement authentication",
      description: "Add email magic link login and session management",
      status: "in_progress" as const,
      priority: "high" as const,
    },
    {
      title: "Create dashboard page",
      description: "Build the main dashboard with workspace overview",
      status: "in_progress" as const,
      priority: "medium" as const,
    },
    {
      title: "Add kanban board",
      description: "Implement drag and drop kanban board with dnd-kit",
      status: "backlog" as const,
      priority: "medium" as const,
    },
    {
      title: "Implement calendar view",
      description: "Add calendar view to show tasks by due date",
      status: "backlog" as const,
      priority: "low" as const,
    },
    {
      title: "Add file attachments",
      description: "Implement file upload and attachment support",
      status: "backlog" as const,
      priority: "low" as const,
    },
    {
      title: "Fix login redirect bug",
      description: "Users are not redirected properly after login",
      status: "backlog" as const,
      priority: "urgent" as const,
    },
  ];

  const { data: insertedTasks } = await supabase
    .from("tasks")
    .insert(
      tasks.map((task) => ({
        ...task,
        workspace_id: workspaceId,
        created_by: user.id,
        due_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      }))
    )
    .select();

  // Add tags to tasks
  if (insertedTasks) {
    const taskTags = [];
    for (let i = 0; i < insertedTasks.length; i++) {
      const task = insertedTasks[i];
      const tagIndex = i % tagMap.size;
      const tagName = Array.from(tagMap.keys())[tagIndex];
      const tagId = tagMap.get(tagName);
      if (tagId) {
        taskTags.push({ task_id: task.id, tag_id: tagId });
      }
    }
    await supabase.from("task_tags").insert(taskTags);
  }

  // Add some subtasks
  if (insertedTasks && insertedTasks.length > 0) {
    const subtasks = [
      { task_id: insertedTasks[1].id, title: "Set up Supabase project", is_done: true },
      { task_id: insertedTasks[1].id, title: "Create login form UI", is_done: true },
      { task_id: insertedTasks[1].id, title: "Implement magic link sending", is_done: false },
    ];
    await supabase.from("subtasks").insert(subtasks);
  }

  // Add some comments
  if (insertedTasks && insertedTasks.length > 0) {
    const comments = [
      {
        task_id: insertedTasks[1].id,
        user_id: user.id,
        content: "Started working on this. Will have a draft ready by tomorrow.",
      },
      {
        task_id: insertedTasks[2].id,
        user_id: user.id,
        content: "Dashboard wireframes are ready for review.",
      },
    ];
    await supabase.from("comments").insert(comments);
  }

  revalidatePath("/tasks");
  revalidatePath("/board");
  revalidatePath("/calendar");

  return { success: true, tasksCreated: insertedTasks?.length || 0 };
}
