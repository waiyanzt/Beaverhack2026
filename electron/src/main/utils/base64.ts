export type DataUrlParts = {
	mimeType: string;
	data: Buffer;
};

export function decodeDataUrl(dataUrl: string): DataUrlParts | null {
	const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl.trim());

	if (!match) {
		return null;
	}

	const [, mimeType, base64] = match;

	try {
		return {
			mimeType,
			data: Buffer.from(base64, "base64"),
		};
	} catch {
		return null;
	}
}

export function encodeDataUrl(mimeType: string, data: Buffer): string {
	const base64 = data.toString("base64");
	return `data:${mimeType};base64,${base64}`;
}
