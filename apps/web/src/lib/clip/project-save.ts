export function projectSaveError(
  res: { ok: boolean; status: number },
  message?: string
): string | null {
  if (res.ok) return null;
  return message || `Could not save the sponsor logo (${res.status}).`;
}
