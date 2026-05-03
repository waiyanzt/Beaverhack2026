#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
video_path="${1:-"$repo_root/samples/camera-capture-1777772334424.mp4"}"

base_url="${MODEL_BASE_URL:-http://100.93.134.64:8000}"
model="${MODEL_NAME:-/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120}"
api_key="${MODEL_API_KEY:-}"
use_audio_in_video="${USE_AUDIO_IN_VIDEO:-true}"

if [[ ! -f "$video_path" ]]; then
  echo "Video file not found: $video_path" >&2
  exit 1
fi

video_mime_type="video/mp4"

case "${video_path,,}" in
  *.mp4)
    video_mime_type="video/mp4"
    ;;
  *.webm)
    video_mime_type="video/webm"
    ;;
  *)
    echo "Warning: unknown video extension, defaulting to video/mp4" >&2
    video_mime_type="video/mp4"
    ;;
esac

export VIDEO_MIME_TYPE="$video_mime_type"

payload_file="$(mktemp)"
base64_file="$(mktemp)"
trap 'rm -f "$payload_file" "$base64_file"' EXIT

echo "Video path: $video_path"
echo "Video MIME type: $video_mime_type"
echo "Base URL: ${base_url%/}"
echo "Model: $model"
echo "use_audio_in_video: $use_audio_in_video"
echo ""

if command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe stream check:"
  ffprobe -v error \
    -show_entries stream=index,codec_type,codec_name,channels,sample_rate \
    -of json \
    "$video_path" || true
  echo ""
else
  echo "ffprobe not found; skipping local media stream check."
  echo "Install ffmpeg/ffprobe if you want to verify whether the MP4 actually has an audio stream."
  echo ""
fi

if command -v jq >/dev/null 2>&1; then
  echo "Server models:"
  curl -sS "${base_url%/}/v1/models" | jq . || true
  echo ""
else
  echo "jq not found; skipping pretty /v1/models output."
  curl -sS "${base_url%/}/v1/models" || true
  echo ""
  echo ""
fi

base64 < "$video_path" | tr -d '\n' > "$base64_file"

node --input-type=module - "$model" "$base64_file" "$use_audio_in_video" > "$payload_file" <<'NODE'
import { readFileSync } from "node:fs";

const [model, base64FilePath, useAudioInVideo] = process.argv.slice(2);

if (!model) {
  throw new Error("Missing model argument.");
}

if (!base64FilePath) {
  throw new Error("Missing base64 file argument.");
}

const mimeType = process.env.VIDEO_MIME_TYPE ?? "video/mp4";
const videoBase64 = readFileSync(base64FilePath, "utf8").trim();
const videoDataUrl = `data:${mimeType};base64,${videoBase64}`;

const payload = {
  model,
  messages: [
    {
      role: "system",
      content: [
        "You are AuTuber, a VTuber stream-direction agent.",
        "Return a concise response focused on what is heard in the clip.",
        "Do not invent audio details that are not supported.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        {
          type: "video_url",
          video_url: {
            url: videoDataUrl,
          },
        },
        {
          type: "text",
          text: [
            "Analyze the audio in this video.",
            "First say exactly one of: AUDIO_DETECTED or NO_AUDIO_DETECTED.",
            "Then summarize spoken words, notable sounds, tone, and whether the audio suggests excitement, laughter, silence, or other clear cues.",
            "If the audio is unclear or absent, say so directly.",
            "Keep the answer short and factual.",
          ].join(" "),
        },
      ],
    },
  ],

  temperature: 0.2,
  max_tokens: 1024,
  stream: false,

  // vLLM extra parameters must be top-level for raw HTTP/curl.
  // Do not put this inside "extra_body" unless you are using the OpenAI SDK.
  top_k: 1,
  chat_template_kwargs: {
    enable_thinking: false,
  },
  mm_processor_kwargs: {
    use_audio_in_video: useAudioInVideo === "true",
  },
};

process.stdout.write(JSON.stringify(payload));
NODE

headers=(
  -H "Content-Type: application/json"
)

if [[ -n "$api_key" ]]; then
  headers+=(-H "Authorization: Bearer ${api_key}")
fi

echo "Request payload without base64 blob:"
node --input-type=module - "$payload_file" <<'NODE'
import { readFileSync } from "node:fs";

const payloadFile = process.argv[2];

if (!payloadFile) {
  throw new Error("Missing payload file argument.");
}

const payload = JSON.parse(readFileSync(payloadFile, "utf8"));

for (const message of payload.messages) {
  if (!Array.isArray(message.content)) {
    continue;
  }

  for (const item of message.content) {
    if (item.type === "video_url" && item.video_url?.url) {
      item.video_url.url = `${item.video_url.url.slice(0, 80)}...<base64 omitted>`;
    }
  }
}

console.log(JSON.stringify(payload, null, 2));
NODE

echo ""
echo "Sending request..."
echo ""

curl --fail-with-body -sS "${headers[@]}" \
  -X POST "${base_url%/}/v1/chat/completions" \
  --data-binary @"$payload_file" \
  | node --input-type=module -e '
let input = "";

process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  try {
    process.stdout.write(`${JSON.stringify(JSON.parse(input), null, 2)}\n`);
  } catch {
    process.stdout.write(input);
  }
});
'