import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  status: z.enum(["backlog", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  tag_ids: z.array(z.string().uuid()).optional(),
});

export const subtaskSchema = z.object({
  title: z.string().min(1, "Subtask title is required").max(255),
  is_done: z.boolean().optional(),
  position: z.number().optional(),
});

export const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
});

export const taskFilterSchema = z.object({
  status: z.enum(["backlog", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee_id: z.string().uuid().optional(),
  tag_id: z.string().uuid().optional(),
  due_date_from: z.string().optional(),
  due_date_to: z.string().optional(),
  search: z.string().optional(),
  sort_by: z.enum(["due_date", "created_at", "priority", "title"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;
export type SubtaskFormData = z.infer<typeof subtaskSchema>;
export type CommentFormData = z.infer<typeof commentSchema>;
export type TaskFilterData = z.infer<typeof taskFilterSchema>;
