// Simulated profiles and what each one may do.
export const PROFILES = ["colaborador", "publicador", "aprovador", "admin"];
export const PROFILE_LABELS = { colaborador: "Colaborador", publicador: "Publicador", aprovador: "Aprovador", admin: "Administrador" };

const BASE = ["catalog.view", "solution.favorite", "solution.request", "solution.rate", "solution.confirmUse", "me.view", "team.view"];
const PUBLISH = ["solution.publish", "solution.editOwn", "access.decide", "team.manage"];
const APPROVE = ["approvals.view", "approvals.decide"];
const ADMIN = ["admin.view", "admin.manage"];

const MATRIX = {
  colaborador: new Set(BASE),
  publicador: new Set([...BASE, ...PUBLISH]),
  aprovador: new Set([...BASE, ...APPROVE]),
  admin: new Set([...BASE, ...PUBLISH, ...APPROVE, ...ADMIN]),
};

export const can = (profile, action) => MATRIX[profile]?.has(action) ?? false;

const ROUTE_PERMISSION = { aprovacoes: "approvals.view", admin: "admin.view", publicar: "solution.publish" };

export const canOpenRoute = (profile, route) => (ROUTE_PERMISSION[route] ? can(profile, ROUTE_PERMISSION[route]) : can(profile, "catalog.view"));
