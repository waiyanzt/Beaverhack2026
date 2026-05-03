export const VTS_CUE_LABEL_VALUES = [
  "greeting",
  "wave",
  "happy",
  "excited",
  "laughing",
  "evil_laugh",
  "smug",
  "angry",
  "frustrated",
  "shocked",
  "surprised",
  "sad",
  "crying",
  "cute_reaction",
  "love_reaction",
  "confused",
  "embarrassed",
  "sleepy",
  "dramatic_moment",
  "magic_moment",
  "hype_moment",
  "idle",
  "manual_request",
  "unknown",
  "vacant",
] as const;

export const DEFAULT_VTS_CUE_LABELS = VTS_CUE_LABEL_VALUES.map((id) => ({
  id,
  name: id
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" "),
  description: "",
}));

export const RESERVED_VTS_CUE_LABEL_VALUES = ["idle", "manual_request", "unknown"] as const;
