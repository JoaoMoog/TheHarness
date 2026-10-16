import { z } from 'zod';
import { planSchema } from './planner';

export const workSchema = z.object({
  version: z.literal(1), owner: z.string().max(300), sourceId: z.string().max(100), sourceRevision: z.number().int(),
  draftId: z.string().optional(), draftRevision: z.number().int().optional(), expiresAt: z.string().optional(),
  prompt: z.string().max(4000), lastPrompt: z.string().max(4000), plan: planSchema.nullable(),
  assistantOpen: z.boolean(), recovery: z.string().max(1000).optional(),
}).strict();
export type WorkSession = z.infer<typeof workSchema>;

export function workOwner(actorId: string, workspaceId: string) {
  return actorId === workspaceId ? actorId : `${actorId}::${workspaceId}`;
}
