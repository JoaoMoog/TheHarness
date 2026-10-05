/** In-memory work queue for judgments that need a person. Resets when the server restarts. */
export interface QueueItem {
  readonly id: string;
  readonly judgment: string;
  readonly input: unknown;
  readonly value: unknown;
  readonly confidence: number;
  readonly status: "open" | "resolved";
  readonly createdAt: string;
  readonly decision?: string;
  readonly resolvedAt?: string;
}

export type NewQueueItem = Pick<QueueItem, "judgment" | "input" | "value" | "confidence">;

export type ResolveResult =
  | { readonly kind: "resolved"; readonly item: QueueItem }
  | { readonly kind: "notFound" }
  | { readonly kind: "alreadyResolved" };

export class WorkQueue {
  private items: readonly QueueItem[] = [];
  private sequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  enqueue(entry: NewQueueItem): QueueItem {
    this.sequence += 1;
    const item: QueueItem = Object.freeze({
      ...entry,
      id: `Q-${String(this.sequence).padStart(4, "0")}`,
      status: "open",
      createdAt: this.now().toISOString(),
    });
    this.items = [...this.items, item];
    return item;
  }

  resolve(id: string, decision: string): ResolveResult {
    const current = this.items.find((i) => i.id === id);
    if (!current) return { kind: "notFound" };
    if (current.status === "resolved") return { kind: "alreadyResolved" };
    const item: QueueItem = Object.freeze({
      ...current,
      status: "resolved",
      decision,
      resolvedAt: this.now().toISOString(),
    });
    this.items = this.items.map((i) => (i.id === id ? item : i));
    return { kind: "resolved", item };
  }

  list(): readonly QueueItem[] {
    return this.items;
  }
}
