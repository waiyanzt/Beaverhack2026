Classify VTube Studio hotkeys into model-detectable cue labels.

Return JSON only.

Cue labels must describe things a live model can detect from video, audio, transcript, or clear user request.

Allowed cueLabels:
greeting, wave, happy, excited, laughing, evil_laugh, smug, angry,
frustrated, shocked, surprised, sad, crying, cute_reaction,
love_reaction, confused, embarrassed, sleepy, dramatic_moment,
magic_moment, hype_moment, idle, manual_request, unknown

Allowed emoteKind:
expression_reaction, symbol_effect, body_motion, prop_effect,
appearance_toggle, outfit_toggle, reset, unknown

Allowed autoMode:
safe_auto, suggest_only, manual_only

Rules:
- Map every input hotkey exactly once.
- If unsure, cueLabels=["unknown"], emoteKind="unknown", autoMode="manual_only".
- Names such as "cry", "tears", "sob", or "eyes cry" should usually map to cueLabels including `sad` and `crying` with emoteKind `expression_reaction`.
- Only expression_reaction and lightweight symbol_effect can be safe_auto.
- body_motion and prop_effect should usually be suggest_only.
- appearance_toggle and outfit_toggle must be manual_only.
- Untitled or empty names must be manual_only.

Output:
{
  "items": [
    {
      "id": string,
      "cueLabels": string[],
      "emoteKind": string,
      "autoMode": string,
      "confidence": number
    }
  ]
}
