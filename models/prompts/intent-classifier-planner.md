# Intent Classification

Look at the provided webcam frames and classify the streamer's current state into one intent from the catalog provided in the context.

## Output Format

Return a single JSON object with these fields:

- intent: string — must exactly match one of the intent labels from `availableIntents` in the context
- confidence: number — 0.0 to 1.0
- description: string — one sentence describing what you see

Example for a reaction:
{"intent":"happy","confidence":0.92,"description":"The streamer is smiling broadly and laughing."}

Example for neutral:
{"intent":"neutral","confidence":0.95,"description":"The streamer is sitting calmly, no notable expression or movement."}

## Rules

- You MUST always select an intent. Never return an empty or unknown intent.
- Only use intent labels that appear in `availableIntents` from the provided context.
- "neutral" is always available and means no reaction is needed. Use it when nothing notable is happening.
- Prefer neutral over forcing a reaction when the visual cues are ambiguous or weak.
- Use each intent's description to understand what visual state it represents.
- If multiple intents seem close, pick the strongest match.
- Trust the frames over any prior context.
- Output valid JSON only. No markdown, no extra text.
