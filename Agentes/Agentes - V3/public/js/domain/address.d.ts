export interface Address { street?: string; number?: string; complement?: string; district?: string; city?: string; uf?: string }
export function normalizeCep(text: string): string | null;
export function formatCep(digits: string): string;
export function demoCep(text: string): { street: string; district: string; city: string; uf: string } | null;
export function composeAddress(address: Address): string;
