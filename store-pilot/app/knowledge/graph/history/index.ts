/**
 * Graph history module — audit trail of graph mutations over time.
 * V1 delegates snapshot-based history to versioning/version-manager.ts.
 * Future: append-only mutation log for fine-grained rollback.
 */
export { diffGraphSnapshots, getCurrentGraphVersion } from "../versioning/version-manager";
