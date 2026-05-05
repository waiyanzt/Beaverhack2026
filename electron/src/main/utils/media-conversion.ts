import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";

export type MediaClipInput = {
  data: Buffer;
  mimeType: string;
};

const getMediaExtension = (mimeType: string): string => {
  const baseMimeType = mimeType.split(";")[0]?.trim().toLowerCase();

  if (baseMimeType === "video/mp4" || baseMimeType === "audio/mp4") {
    return "mp4";
  }

  if (baseMimeType === "video/webm" || baseMimeType === "audio/webm") {
    return "webm";
  }

  if (baseMimeType === "audio/wav" || baseMimeType === "audio/wave" || baseMimeType === "audio/x-wav") {
    return "wav";
  }

  if (baseMimeType === "audio/mpeg" || baseMimeType === "audio/mp3") {
    return "mp3";
  }

  if (baseMimeType === "audio/ogg") {
    return "ogg";
  }

  return "bin";
};

export const getBaseMimeType = (mimeType: string): string =>
  mimeType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";

export const runFfmpeg = async (args: string[]): Promise<void> => {
  const ffmpegBinary = getFfmpegBinary();

  await new Promise<void>((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(ffmpegBinary, args);
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code ?? "unknown"}.`));
    });
  });
};

const getFfmpegBinary = (): string => {
  if (typeof ffmpegStatic !== "string") {
    throw new Error("ffmpeg binary is unavailable.");
  }

  return ffmpegStatic;
};

export const convertVideoClipToMp4 = async (clip: MediaClipInput): Promise<Buffer> => {
  if (getBaseMimeType(clip.mimeType) === "video/mp4") {
    return clip.data;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "autuber-model-video-"));

  try {
    const inputPath = join(tempDir, `input.${getMediaExtension(clip.mimeType)}`);
    const outputPath = join(tempDir, "output.mp4");
    await writeFile(inputPath, clip.data);
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const convertVideoAndAudioClipsToMp4 = async (
  videoClip: MediaClipInput,
  audioClip: MediaClipInput,
): Promise<Buffer> => {
  const tempDir = await mkdtemp(join(tmpdir(), "autuber-model-av-"));

  try {
    const videoInputPath = join(tempDir, `input-video.${getMediaExtension(videoClip.mimeType)}`);
    const audioInputPath = join(tempDir, `input-audio.${getMediaExtension(audioClip.mimeType)}`);
    const outputPath = join(tempDir, "output.mp4");
    await writeFile(videoInputPath, videoClip.data);
    await writeFile(audioInputPath, audioClip.data);
    await runFfmpeg([
      "-y",
      "-i",
      videoInputPath,
      "-i",
      audioInputPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-af",
      "aresample=async=1:first_pts=0",
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};


export const combineVideoClipsWithAudioToMp4 = async (options: {
  leftVideoClip: MediaClipInput;
  rightVideoClip: MediaClipInput;
  audioClip?: MediaClipInput | null;
}): Promise<Buffer> => {
  const tempDir = await mkdtemp(join(tmpdir(), "autuber-model-combined-"));

  try {
    const leftInputPath = join(tempDir, `left.${getMediaExtension(options.leftVideoClip.mimeType)}`);
    const rightInputPath = join(tempDir, `right.${getMediaExtension(options.rightVideoClip.mimeType)}`);
    const outputPath = join(tempDir, "output.mp4");
    await writeFile(leftInputPath, options.leftVideoClip.data);
    await writeFile(rightInputPath, options.rightVideoClip.data);

    const args = [
      "-y",
      "-i",
      leftInputPath,
      "-i",
      rightInputPath,
    ];

    if (options.audioClip) {
      const audioInputPath = join(tempDir, `audio.${getMediaExtension(options.audioClip.mimeType)}`);
      await writeFile(audioInputPath, options.audioClip.data);
      args.push("-i", audioInputPath);
    }

    args.push(
      "-filter_complex",
      [
        "[0:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[left]",
        "[1:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[right]",
        "[left][right]hstack=inputs=2[v]",
      ].join(";"),
      "-map",
      "[v]",
    );

    if (options.audioClip) {
      args.push(
        "-map",
        "2:a:0",
        "-c:a",
        "aac",
        "-af",
        "aresample=async=1:first_pts=0",
      );
    } else {
      args.push("-an");
    }

    args.push(
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-shortest",
      outputPath,
    );

    await runFfmpeg(args);

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const convertAudioClipToWav = async (clip: MediaClipInput): Promise<Buffer> => {
  const baseMimeType = getBaseMimeType(clip.mimeType);
  if (baseMimeType === "audio/wav" || baseMimeType === "audio/wave" || baseMimeType === "audio/x-wav") {
    return clip.data;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "autuber-model-audio-"));

  try {
    const inputPath = join(tempDir, `input.${getMediaExtension(clip.mimeType)}`);
    const outputPath = join(tempDir, "output.wav");
    await writeFile(inputPath, clip.data);
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};
