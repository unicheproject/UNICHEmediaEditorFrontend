export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export const TRANSCRIPT_EXPORT_FORMATS = [
  { value: "txt", label: ".txt", mimeType: "text/plain" },
  { value: "srt", label: ".srt", mimeType: "application/x-subrip" },
  { value: "json", label: ".json", mimeType: "application/json" },
] as const;

export type TranscriptExportFormat = (typeof TRANSCRIPT_EXPORT_FORMATS)[number]["value"];

function mimeTypeFor(format: TranscriptExportFormat): string {
  return TRANSCRIPT_EXPORT_FORMATS.find((option) => option.value === format)?.mimeType ?? "text/plain";
}

function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const milliseconds = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const pad = (value: number, size = 2) => value.toString().padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(milliseconds, 3)}`;
}

function transcriptToSrt(text: string, segments: TranscriptSegment[] | null): string {
  const cues = segments?.length
    ? segments
    : [{ start: 0, end: Math.max(4, text.length / 15), text }];

  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text.trim()}\n`,
    )
    .join("\n");
}

function transcriptToJson(text: string, segments: TranscriptSegment[] | null): string {
  return JSON.stringify(segments?.length ? { text, segments } : { text }, null, 2);
}

export function transcriptExportContent(
  format: TranscriptExportFormat,
  text: string,
  segments: TranscriptSegment[] | null,
): string {
  if (format === "srt") {
    return transcriptToSrt(text, segments);
  }
  if (format === "json") {
    return transcriptToJson(text, segments);
  }
  return text;
}

export function transcriptExportFile(
  filenameBase: string,
  format: TranscriptExportFormat,
  text: string,
  segments: TranscriptSegment[] | null,
): File {
  const content = transcriptExportContent(format, text, segments);
  return new File([content], `${filenameBase}.${format}`, { type: mimeTypeFor(format) });
}
