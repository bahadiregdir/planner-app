export interface Project {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: 'todo' | 'inprogress' | 'done';
  priority: number;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  subtasks?: Subtask[];
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  project_id: number | null;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
}

export interface ElectronAPI {
  getProjects: () => Promise<Project[]>;
  createProject: (data: { name: string; description?: string; color?: string }) => Promise<Project>;
  updateProject: (data: { id: number; name: string; description?: string; color?: string }) => Promise<Project>;
  deleteProject: (id: number) => Promise<{ success: boolean }>;
  getTodos: (projectId: number) => Promise<Todo[]>;
  createTodo: (data: { project_id: number; title: string; description?: string; status?: string; priority?: number; due_date?: string }) => Promise<Todo>;
  updateTodo: (data: { id: number; title?: string; description?: string; status?: string; position?: number; priority?: number; due_date?: string }) => Promise<Todo>;
  deleteTodo: (id: number) => Promise<{ success: boolean }>;
  updateTodoStatus: (data: { id: number; status: string }) => Promise<{ success: boolean }>;
  onShortcut: (callback: (shortcut: string) => void) => void;
  workStart: (projectId: number) => Promise<any>;
  workStop: () => Promise<any>;
  workGetProjectToday: (projectId: number) => Promise<any>;
  workGetProjectStats: (projectId: number) => Promise<{ sessions: any[]; totalMinutes: number }>;
  workGetToday: () => Promise<any>;
  workGetReport: () => Promise<{ sessions: any[]; totalWork: number; totalBreak: number }>;
  settingsGet: (key: string) => Promise<any>;
  settingsSet: (key: string, value: any) => Promise<{ success: boolean }>;
  showNotification: (title: string, body: string) => Promise<void>;
  updateTrayState: (state: { isWorking: boolean; isBreak: boolean; timeLeft: number; isPaused: boolean }) => Promise<void>;
  onTrayState: (callback: (state: any) => void) => void;
  showBreakOverlay: () => Promise<void>;
  hideBreakOverlay: () => Promise<void>;
  snoozeBreak: (minutes: number) => Promise<void>;
  skipBreak: () => Promise<void>;
  tagsGetAll: (projectId?: number) => Promise<Tag[]>;
  tagsCreate: (data: { name: string; color?: string; project_id?: number }) => Promise<Tag>;
  tagsDelete: (id: number) => Promise<{ success: boolean }>;
  tagsAttach: (todoId: number, tagId: number) => Promise<{ success: boolean }>;
  tagsDetach: (todoId: number, tagId: number) => Promise<{ success: boolean }>;
  tagsGetByTodo: (todoId: number) => Promise<Tag[]>;
  subtasksGetByTodo: (todoId: number) => Promise<Subtask[]>;
  subtasksCreate: (data: { todo_id: number; title: string }) => Promise<Subtask>;
  subtasksToggle: (id: number, completed: boolean) => Promise<{ success: boolean }>;
  subtasksDelete: (id: number) => Promise<{ success: boolean }>;
  subtasksReorder: (todoId: number, orderedIds: number[]) => Promise<{ success: boolean }>;
  updateCheck?: () => Promise<any>;
  updateDownload?: () => Promise<any>;
  updateInstall?: () => void;
  onUpdateAvailable?: (callback: (info: any) => void) => void;
  onUpdateProgress?: (callback: (progress: any) => void) => void;
  onUpdateDownloaded?: (callback: (info: any) => void) => void;
  backupExport?: () => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
  backupImport?: () => Promise<{ success: boolean; error?: string; canceled?: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
