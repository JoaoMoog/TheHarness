export function normText(text: unknown): string;
export function matches(text: string, query: string): boolean;
export function searchItems<T extends { title: string; detail?: string }>(items: T[], query: string): T[];
