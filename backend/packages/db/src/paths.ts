import { fileURLToPath } from "node:url";

/** Absolute path to the SQL migrations directory. */
export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
