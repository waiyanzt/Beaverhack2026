import { z } from "zod";

const captureDetailSchema = z.enum(["low", "high"]);

const resolutionSchema = z
  .string()
  .regex(/^\d+x\d+$/, "Resolution must match WIDTHxHEIGHT.");

const cameraConfigSchema = z
  .object({
    enabled: z.boolean(),
    fps: z.number().min(0),
    maxFrames: z.number().int().min(0),
    resolution: resolutionSchema,
    jpegQuality: z.number().min(1).max(100),
    detail: captureDetailSchema.optional(),
    clipDurationSeconds: z.number().min(0.25),
    clipIntervalSeconds: z.number().min(0.1).optional(),
    maxClips: z.number().int().min(1),
    deviceId: z.string().min(1).nullable().optional(),
  })
  .strict();

const screenConfigSchema = z
  .object({
    enabled: z.boolean(),
    fps: z.number().min(0),
    maxFrames: z.number().int().min(0),
    resolution: resolutionSchema,
    jpegQuality: z.number().min(1).max(100),
    detail: captureDetailSchema.optional(),
    clipDurationSeconds: z.number().min(0.25),
    clipIntervalSeconds: z.number().min(0.1).optional(),
    maxClips: z.number().int().min(1),
    sourceId: z.string().min(1).nullable().optional(),
  })
  .strict();

const audioConfigSchema = z
  .object({
    enabled: z.boolean(),
    sampleRate: z.number().int().min(8000),
    channels: z.number().int().min(1).max(2),
    bufferDurationSeconds: z.number().min(0.25),
    clipIntervalSeconds: z.number().min(0.1).optional(),
    transcriptionEnabled: z.boolean(),
    sendRawAudio: z.boolean(),
    deviceId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const captureStartRequestSchema = z
  .object({
    camera: cameraConfigSchema,
    screen: screenConfigSchema,
    audio: audioConfigSchema,
  })
  .strict();

export const captureFramePayloadSchema = z
  .object({
    kind: z.enum(["camera", "screen", "window"]),
    timestampMs: z.number().int().min(0),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    mimeType: z.enum(["image/jpeg", "image/png"]),
    dataUrl: z.string().min(1),
    detail: captureDetailSchema,
  })
  .strict();

export const captureAudioPayloadSchema = z
  .object({
    timestampMs: z.number().int().min(0),
    durationMs: z.number().int().min(0),
    mimeType: z.string().min(1),
    data: z.instanceof(Uint8Array),
  })
  .strict();

export const captureClipPayloadSchema = z
  .object({
    kind: z.enum(["camera", "screen", "audio"]),
    timestampMs: z.number().int().min(0),
    durationMs: z.number().int().min(0),
    mimeType: z.string().min(1),
    data: z.instanceof(Uint8Array),
  })
  .strict();

export const captureErrorPayloadSchema = z
  .object({
    source: z.enum(["camera", "screen", "audio", "system"]),
    message: z.string().min(1),
    timestampMs: z.number().int().min(0),
  })
  .strict();

export const captureAudioLevelPayloadSchema = z
  .object({
    timestampMs: z.number().int().min(0),
    level: z.number().min(0).max(1),
  })
  .strict();

export const captureExportClipRequestSchema = z
  .object({
    kind: z.enum(["camera", "screen", "audio"]),
    includeAudio: z.boolean().optional(),
  })
  .strict();

export type CaptureStartRequestSchema = z.infer<typeof captureStartRequestSchema>;
export type CaptureFramePayloadSchema = z.infer<typeof captureFramePayloadSchema>;
export type CaptureAudioPayloadSchema = z.infer<typeof captureAudioPayloadSchema>;
export type CaptureClipPayloadSchema = z.infer<typeof captureClipPayloadSchema>;
export type CaptureErrorPayloadSchema = z.infer<typeof captureErrorPayloadSchema>;
export type CaptureAudioLevelPayloadSchema = z.infer<typeof captureAudioLevelPayloadSchema>;
export type CaptureExportClipRequestSchema = z.infer<typeof captureExportClipRequestSchema>;
