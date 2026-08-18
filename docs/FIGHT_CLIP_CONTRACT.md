# Fight-footage and sponsor-clip behavior contract

This vertical mode extends the existing generic clipping/render API; it does not replace it.

## Required behaviors

- Analyze the full timed transcript while accepting optional fight context: fighter names, event, round windows, source duration, and sponsor identity.
- Prefer decisive action, clean exchanges, entrances, crowd reactions, corner instruction, and authentic interview quotes.
- Preserve complete action arcs: setup, exchange, and reaction. Add bounded visual handles around action but never cross the source or a known round.
- Never invent a fighter, round, result, strike, quote, or sponsor claim. Missing metadata stays missing.
- Return structured fight metadata without removing existing clip fields: `momentType`, `round`, `fighterNames`, `sponsorFriendly`, and `contentMode`.
- Keep generic mode backward compatible when no context is supplied.
- Render sponsor logos from HTTPS or local application paths only; reject unsafe protocols and malformed colors.
- Keep branding secondary: logo width is capped at 22% of frame width, opacity is bounded, and placement respects a 5–15% safe area.
- Preserve input indexing when source audio, looping music, captions, and sponsor art are combined.
- Continue producing H.264/AAC fast-start MP4 in 9:16, 1:1, or 16:9.

## Edge cases

- Empty/partial fight metadata.
- A highlight at source time zero or at the final frame.
- Action that overlaps a round boundary.
- Interviews/corner quotes that must not receive action handles.
- Invalid, overlapping, or absent round markers.
- Logo without music and logo with music.
- Excessive opacity/safe-area values.
- Unsafe asset URLs and injection-like color strings.
- Legacy callers that send only `count` and timed words.

## Public interfaces preserved

- `POST /api/generate-clips`: existing body and response remain valid; optional `context` adds vertical behavior and metadata.
- `POST /api/render`: existing `RenderRequestOptions` remain valid; optional `sponsor` adds branding.
- `CandidateClip`, `ViralClip`, and `RenderSpec`: existing required fields are unchanged; new fields are optional.
- Existing clip, timeline, caption, music, publish, and download flows continue to work without sponsor/fight options.

## Next vertical milestones

The current implementation is transcript/context-driven. Production-grade automated strike and face tracking should add detector observations to the existing crop-keyframe contract rather than inventing labels from transcript text. Round extraction from broadcast clocks should likewise produce validated `roundMarkers` before calling clip analysis.
