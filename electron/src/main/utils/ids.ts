import { randomUUID } from "node:crypto";

export function createId(prefix: string = "id"): string {
	const suffix = randomUUID();
	return `${prefix}_${suffix}`;
}
