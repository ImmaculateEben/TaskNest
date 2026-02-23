import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceRole } from "@/lib/workspace/get-current-workspace";
import { taskSchema, taskFilterSchema, TaskFormData } from "./task-schemas";
import { revalidatePath } from "next/cache";

export async function getTasks(filters?: {
  status?: string;
  priority?: string;
  assignee_id?: string;
  tag_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}) {
  const workspace = await requireWorkspaceRole(["owner", "admin", "member", "viewer"]);
  const supabase = createClient();

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(id, display_name, avatar_url, email),
      created_by_profile:profiles!tasks_created_by_fkey(id, display_name, avatar_url, email),
      tags(
        id,
        name,
        color
      )
    `)
    .eq("workspace_id", workspace.id);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.assignee_id) {
    query = query.eq("assignee_id", filters.assignee_id);
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  // Sort
  const sortBy = filters?.sort_by || "created_at";
  const sortOrder = filters?.sort_order || "desc";
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Filter by tags if needed
  let tasks = data || [];
  if (filters?.tag_id) {
    tasks = tasks.filter((task) =>
      task.tags?.some((tag: { id: string }) => tag.id === filters.tag_id)
    );
  }

  return tasks;
}

export async function getTask(taskId: string) {
  const workspace = await requireWorkspaceRole(["owner", "admin", "member", "viewer"]);
  const supabase = createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(id, display_name, avatar_url, email),
      created_by_profile:profiles!tasks_created_by_fkey(id, display_name, avatar_url, email),
      tags(
        id,
        name,
        color
      ),
      subtasks(
        id,
        title,
        is_done,
        position,
        created_at
      ),
      comments(
        id,
        content,
        created_at,
        updated_at,
        user:profiles!comments_user_id_fkey(id, display_name, avatar_url, email)
      ),
      attachments(
        id,
        file_name,
        file_type,
        file_size,
        file_path,
        created_at,
        user:profiles!attachments_user_id_fkey(id, display_name, avatar_url, email)
      )
    `)
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return task;
}

export async function createTask(data: TaskFormData) {
  const workspace = await requireWorkspaceRole(["owner", "admin", "member"]);
  const supabase = createClient();

  // Validate
  const validated = taskSchema.parse(data);

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Check if member can create task (if member, must assign to self)
  if (workspace.role === "member" && validated.assignee_id !== user.id) {
    throw new Error("Members can only create tasks assigned to themselves");
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspace.id,
      title: validated.title,
      description: validated.description,
      status: validated.status,
      priority: validated.priority,
      due_date: validated.due_date,
      assignee_id: validated.assignee_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Add tags if provided
  if (validated.tag_ids && validated.tag_ids.length > 0) {
    const tagInserts = validated.tag_ids.map((tagId) => ({
      task_id: task.id,
      tag_id: tagId,
    }));
    await supabase.from("task_tags").insert(tagInserts);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    workspace_id: workspace.id,
    task_id: task.id,
    actor_id: user.id,
    action: "task_created",
    meta: { title: task.title },
  });

  revalidatePath("/tasks");
  revalidatePath("/board");
  revalidatePath("/calendar");

  return task;
}

export async function updateTask(taskId: string, data: Partial<TaskFormData>) {
  const workspace = await requireWorkspaceRole(["owner", "admin", "member"]);
  const supabase = createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Get the task first
  const { data: existingTask } = await supabase
    .from("tasks")
    .select("created_by, assignee_id")
    .eq("id", taskId)
    .single();

  if (!existingTask) {
    throw new Error("Task not found");
  }

  // Check permissions
  if (workspace.role === "member") {
    if (existingTask.created_by !== user.id && existingTask.assignee_id !== user.id) {
      throw new Error("You can only update tasks you created or are assigned to");
    }
  }

  // Validate
  const validated = taskSchema.partial().parse(data);

  const { data: task, error } = await supabase
    .from("tasks")
    .update({
      title: validated.title,
      description: validated.description,
      status: validated.status,
      priority: validated.priority,
      due_date: validated.due_date,
      assignee_id: validated.assignee_id,
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Update tags if provided
  if (validated.tag_ids) {
    await supabase.from("task_tags").delete().eq("task_id", taskId);
    if (validated.tag_ids.length > 0) {
      const tagInserts = validated.tag_ids.map((tagId) => ({
        task_id: taskId,
        tag_id: tagId,
      }));
      await supabase.from("task_tags").insert(tagInserts);
    }
  }

  // Log activity
  await supabase.from("activity_log").insert({
    workspace_id: workspace.id,
    task_id: taskId,
    actor_id: user.id,
    action: "task_updated",
    meta: { title: task.title },
  });

  revalidatePath("/tasks");
  revalidatePath("/board");
  revalidatePath("/calendar");
  revalidatePath(`/tasks/${taskId}`);

  return task;
}

export async function deleteTask(taskId: string) {
  const workspace = await requireWorkspaceRole(["owner", "admin"]);
  const supabase = createClient();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
  revalidatePath("/board");
  revalidatePath("/calendar");

  return { success: true };
}

export async function getWorkspaceMembers() {
  const workspace = await requireWorkspaceRole(["owner", "admin", "member", "viewer"]);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      created_at,
      user:profiles(id, display_name, avatar_url, email)
    `)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}
