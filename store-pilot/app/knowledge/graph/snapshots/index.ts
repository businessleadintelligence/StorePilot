/**
 * Graph snapshots module — immutable point-in-time graph captures.
 * Snapshots are created by versioning/version-manager.ts after each build completes.
 */
export { createGraphSnapshot, diffGraphSnapshots } from "../versioning/version-manager";
