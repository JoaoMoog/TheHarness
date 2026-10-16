export interface WaContact { id: string; first: string; clientName: string; providerName: string; phone: string }
export interface WaReply { text: string; buttons?: string[]; card?: { title: string; lines: [string, string][] } }
export interface WaThread { step: string; draft: any; contractId: string | null; messages?: ({ from: "me" | "bot" } & WaReply)[] }
export interface WaEffect { kind: "createInvite" | "payPix"; [key: string]: any }
export function openThread(me: WaContact): WaThread & { messages: ({ from: "bot" } & WaReply)[] };
export function pixCode(contractId: string, cents: number): string;
export function botTurn(thread: WaThread, input: string, ctx: { me: WaContact; contacts: WaContact[] }): { next: WaThread; replies: WaReply[]; effect: WaEffect | null };
