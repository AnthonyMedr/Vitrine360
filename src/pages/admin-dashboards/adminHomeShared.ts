export type ManagementTask = {
  id: string;
  title: string;
  description: string;
  area: string;
  severity: string;
  owner: string;
  status: string;
  route: string;
  due_at: string;
  external_blocker: boolean;
  evidence: string;
  evidence_url: string;
  note: string;
  source: string;
  recommended_action: string;
};

export type DailyManagement = {
  status: string;
  summary: { total_tasks: number; critical: number; overdue: number; without_owner: number; external_blockers: number; due_today: number };
  priorities: ManagementTask[];
};

export type TasksResponse = { tasks: ManagementTask[] };

export type Draft = {
  id: string;
  title: string;
  description: string;
  area: string;
  severity: string;
  owner: string;
  status: string;
  due_at: string;
  note: string;
  recommended_action: string;
};

export const emptyDaily: DailyManagement = {
  status: "CARREGANDO",
  summary: { total_tasks: 0, critical: 0, overdue: 0, without_owner: 0, external_blockers: 0, due_today: 0 },
  priorities: [],
};

export function taskTone(task: ManagementTask) {
  if (task.severity === "critical") return "danger";
  if (task.severity === "high" || task.severity === "medium") return "warn";
  return "neutral";
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem prazo";
  return date.toLocaleDateString("pt-BR");
}
