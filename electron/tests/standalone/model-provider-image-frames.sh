#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
video_path="${1:-"$repo_root/samples/camera-capture-1777772334424.mp4"}"

base_url="${MODEL_BASE_URL:-http://100.93.134.64:8000}"
model="${MODEL_NAME:-/tmp/bergejac/models/models--nvidia--Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8/snapshots/76955e4cfa2c9a546f5c5f12d869249dcb30d120}"
api_key="${MODEL_API_KEY:-}"
frame_count="${FRAME_COUNT:-11}"
frame_interval_ms="${FRAME_INTERVAL_MS:-200}"

if [[ ! -f "$video_path" ]]; then
  echo "Video file not found: $video_path" >&2
  exit 1
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

echo "Video path: $video_path"
echo "Base URL: ${base_url%/}"
echo "Model: $model"
echo "Frame count: $frame_count"
echo "Frame interval: ${frame_interval_ms}ms"
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

echo "Extracting $frame_count frames at ${frame_interval_ms}ms intervals..."
ffmpeg_args=()
for i in $(seq 0 $((frame_count - 1))); do
  timestamp_sec=$(echo "scale=3; $i * $frame_interval_ms / 1000" | bc)
  ffmpeg_args+=(-ss "$timestamp_sec" -i "$video_path" -frames:v 1 -q:v 2 "$temp_dir/frame_$(printf '%03d' $i).jpg")
done

ffmpeg -y "${ffmpeg_args[@]}" 2>/dev/null || {
  echo "ffmpeg multi-input failed; falling back to sequential extraction..."
  for i in $(seq 0 $((frame_count - 1))); do
    timestamp_sec=$(echo "scale=3; $i * $frame_interval_ms / 1000" | bc)
    ffmpeg -y -ss "$timestamp_sec" -i "$video_path" -frames:v 1 -q:v 2 "$temp_dir/frame_$(printf '%03d' $i).jpg" 2>/dev/null || true
  done
}

actual_frame_count=$(ls -1 "$temp_dir"/frame_*.jpg 2>/dev/null | wc -l)
echo "Extracted $actual_frame_count frames"
echo ""

payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT

node --input-type=module - "$model" "$temp_dir" "$frame_count" > "$payload_file" <<'NODE'
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [model, framesDir, frameCountStr] = process.argv.slice(2);

if (!model) {
  throw new Error("Missing model argument.");
}

if (!framesDir) {
  throw new Error("Missing frames directory argument.");
}

const frameCount = parseInt(frameCountStr ?? "11", 10);
const frameFiles = readdirSync(framesDir)
  .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
  .sort();

const imageParts = frameFiles.map((filename) => {
  const data = readFileSync(join(framesDir, filename));
  const base64 = data.toString("base64");
  return {
    type: "image_url",
    image_url: {
      url: `data:image/jpeg;base64,${base64}`,
      detail: "low",
    },
  };
});

const payload = {
  model,
  messages: [
    {
      role: "system",
      content: [
        "You are AuTuber, a VTuber stream-direction agent.",
        "These are sequential webcam frames captured 200ms apart over ~2 seconds.",
        "Use the sequence of frames to infer motion, expression changes, and context over time.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        ...imageParts,
        {
          type: "text",
          text: [
            "Analyze the person in these sequential frames.",
            "Describe their expression, posture, and emotional state.",
            "If the person seems neutral or idle, say so.",
            "Keep the answer short and factual.",
          ].join(" "),
        },
      ],
    },
  ],
  temperature: 0.2,
  max_tokens: 1024,
  stream: false,
  top_k: 1,
  chat_template_kwargs: {
    enable_thinking: false,
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
    if (item.type === "image_url" && item.image_url?.url) {
      item.image_url.url = `${item.image_url.url.slice(0, 80)}...<base64 omitted>`;
    }
  }
}

console.log(JSON.stringify(payload, null, 2));
NODE

echo ""
echo "Sending request with ${actual_frame_count} frames..."
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