// Server-side public API of the core module. Other modules import core only from here
// or, in client components, from ./shared (no database access).
export * from "./shared";
export { syncPublicHolidays } from "./holidays";
export { findEmployeeByEmail, findEmployeeById, loadActor } from "./access";
export { ensureAdmin, type AdminAccount } from "./admin";
export {
  insertAudited,
  rethrowAsUserError,
  updateAudited,
  type ChangeContext,
} from "./audited";
export * from "./employees";
export * from "./teams";
export * from "./jobs";
