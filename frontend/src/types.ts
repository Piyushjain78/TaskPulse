export type Role = "MANAGER" | "EMPLOYEE";

export type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "APPROVED"
  | "RETURNED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type TimerRunState = "STOPPED" | "RUNNING" | "PAUSED";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId?: string | null;
  phone?: string | null;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assignedTo: string;
  createdBy: string;
  timerRunState: TimerRunState;
  activeSegmentStart?: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; name: string; email: string };
  creator?: { id: string; name: string; email: string };
  totalWorkedSeconds?: number;
  activeElapsedSeconds?: number;
  timeLogs?: { id: string; startTime: string; endTime: string | null }[];
};

export type CommentRow = {
  id: string;
  taskId: string;
  userId: string;
  message: string;
  parentId?: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: Role };
};

export type NotificationRow = {
  id: string;
  message: string;
  taskId: string | null;
  read: boolean;
  createdAt: string;
};
