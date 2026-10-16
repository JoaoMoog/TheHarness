import type { Workspace } from './workspace';
export type Cell = string | number | null;
export type Column = { key: string; label: string; type: 'number' | 'text' | 'date' };
export type Metric = { key: string; label: string; unit: 'BRL' | 'number'; operation: 'sum' | 'average' | 'count'; expression?: string };
export type Rule = { column: string; value: string };
export type Source = {
  id: string; owner: string; name: string; origin: 'sap-demo' | 'file' | 'sap'; domain: string; connector?: 'sap-read';
  columns: Column[]; rows: Record<string, Cell>[]; metrics: Metric[];
  primaryMetric: string; budgetMetric?: string; groupBy: string; dateColumn?: string;
  rule?: Rule; createdAt: string; revision: number; updatedAt?: string;
};
export type Plan = {
  status: 'ready' | 'clarify'; title: string; message: string;
  primaryMetric: string; secondaryMetric: string | null; groupBy: string;
  dateColumn: string | null; chart: 'bar' | 'line'; displayTable: boolean;
  filters: Record<string, string>;
  filterSelections?: Record<string, string[]>;
  selectedMetrics?: string[];
  calculatedMetrics?: (Metric & { expression: string })[];
  periodComparison?: { dateColumn: string; current: string; previous: string };
};
export type Message = { role: 'user' | 'assistant'; text: string };
export type Draft = {
  id: string; owner: string; sourceId: string; sourceRevision: number; revision: number;
  plan: Plan; messages: Message[]; expiresAt: string; reportId?: string; createdBy?: string;
};
export type Report = {
  id: string; owner: string; sourceId: string; plan: Plan; createdAt: string;
  revision?: number; sourceRevision?: number; updatedAt?: string; editedBy?: string;
};
export type Actor = { id: string; name: string; demo: boolean; auth?: 'local' | 'msal' | 'demo'; email?: string };
export type Bootstrap = { actor: Actor; sources: Source[]; reports: Report[]; provider: 'demo' | 'bedrock'; workspace?: Workspace; workspaces?: Workspace[] };
export type ImportSample = { name: string; columns: Column[]; rows: Record<string, Cell>[] };
export type Upload = ImportSample & { id: string; owner: string; expiresAt: string; origin?: 'sap' };
export type ImportPreview = ImportSample & { id: string; rowCount: number; criteriaOptions: { key: string; label: string; values: string[] }[] };
