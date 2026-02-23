export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type TaskStatus = "backlog" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ActivityAction =
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "status_changed"
  | "comment_added"
  | "subtask_added"
  | "attachment_added"
  | "member_added"
  | "member_removed"
  | "role_changed"
  | "workspace_created";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  profile?: Profile;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
  created_by_profile?: Profile;
  tags?: Tag[];
  subtasks?: Subtask[];
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  user?: Profile;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  task_id: string | null;
  actor_id: string;
  action: ActivityAction;
  meta: Record<string, unknown>;
  created_at: string;
  actor?: Profile;
  task?: Task;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id">>;
      };
      workspaces: {
        Row: Workspace;
        Insert: Omit<Workspace, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Workspace, "id">>;
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Omit<WorkspaceMember, "created_at">;
        Update: Partial<Pick<WorkspaceMember, "role">>;
      };
      workspace_invites: {
        Row: WorkspaceInvite;
        Insert: Omit<WorkspaceInvite, "id" | "created_at">;
        Update: Partial<Pick<WorkspaceInvite, "accepted_at">>;
      };
      tags: {
        Row: Tag;
        Insert: Omit<Tag, "id" | "created_at">;
        Update: Partial<Pick<Tag, "name" | "color">>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Task, "id" | "workspace_id" | "created_by">>;
      };
      task_tags: {
        Row: TaskTag;
        Insert: TaskTag;
        Update: never;
      };
      subtasks: {
        Row: Subtask;
        Insert: Omit<Subtask, "id" | "created_at">;
        Update: Partial<Pick<Subtask, "title" | "is_done" | "position">>;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, "id" | "created_at" | "updated_at">;
        Update: Partial<Pick<Comment, "content">>;
      };
      attachments: {
        Row: Attachment;
        Insert: Omit<Attachment, "id" | "created_at">;
        Update: never;
      };
      activity_log: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, "id" | "created_at">;
        Update: never;
      };
    };
  };
}
