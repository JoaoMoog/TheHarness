export type WorkspaceRole = 'reader' | 'editor' | 'admin';
export type Workspace = { id: string; name: string; owner: string; role: WorkspaceRole; personal: boolean };
export type WorkspaceMember = { actorId: string; name: string; role: WorkspaceRole; joinedAt: string };
export type WorkspaceInvite = { id: string; role: WorkspaceRole; email?: string; expiresAt: string; createdAt: string };
export type AuditEntry = { id: number; actorId: string; actorName: string; action: string; target: string; createdAt: string };
export type GovernanceState = { workspace: Workspace; members: WorkspaceMember[]; invites: WorkspaceInvite[]; audit: AuditEntry[] };
