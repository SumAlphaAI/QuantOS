"use client";

import { translate, useOptionalI18n } from "../../i18n/I18nProvider";
import * as Dialog from "@radix-ui/react-dialog";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "../Button/Button";
import { InlineAlert } from "../InlineAlert/InlineAlert";
import { createThemeVariables, useTheme } from "../../theme/ThemeProvider";

export interface DangerConfirmDialogProps {
  trigger: ReactNode; title: string; summary: string; impact: string; confirmPhrase: string; confirmLabel: string;
  mfaRequired?: boolean; finalCheckLabel?: string; correlationId?: string; onConfirm: (input: { phrase: string; mfaCode?: string }) => Promise<void> | void;
}
import { isDangerConfirmationValid } from "./confirmation-policy";
export { isDangerConfirmationValid } from "./confirmation-policy";
export function DangerConfirmDialog({ trigger, title, summary, impact, confirmPhrase, confirmLabel, mfaRequired = false, finalCheckLabel, correlationId, onConfirm }: DangerConfirmDialogProps) {
  const { theme } = useTheme();
  const locale = useOptionalI18n()?.locale ?? "zh-CN";
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  const submitting = useRef(false);
  const [open, setOpen] = useState(false); const [phrase, setPhrase] = useState(""); const [mfaCode, setMfaCode] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null); const phraseId = useId(); const mfaId = useId(); const valid = isDangerConfirmationValid(phrase, confirmPhrase, mfaRequired, mfaCode);
  function reset() { setPhrase(""); setMfaCode(""); setError(false); }
  async function submit() {
    // A synchronous latch also rejects two events before React commits pending state.
    if (!valid || submitting.current) return;
    submitting.current = true; setPending(true); setError(false);
    try { await onConfirm({ phrase, mfaCode: mfaRequired ? mfaCode : undefined }); setOpen(false); reset(); }
    catch { setError(true); setMfaCode(""); }
    finally { submitting.current = false; setPending(false); }
  }
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!submitting.current) { setOpen(next); if (!next) reset(); } }}><Dialog.Trigger asChild>{trigger}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="q-dialog-overlay" /><Dialog.Content lang={locale} className="q-dialog-content quantos-theme" style={createThemeVariables(theme)} onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (submitting.current) event.preventDefault(); }} onInteractOutside={(event) => { if (submitting.current) event.preventDefault(); }}>
    <Dialog.Title className="q-dialog-title">{title}</Dialog.Title><Dialog.Description className="q-dialog-description">{summary}</Dialog.Description>
    <InlineAlert tone="danger" title={t("ui.dialog.warning")}>{impact}</InlineAlert>
    <label className="q-field" htmlFor={phraseId}>{t("ui.dialog.phrase", { phrase: confirmPhrase })}<input className="q-input" id={phraseId} autoComplete="off" value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label>
    {mfaRequired ? <label className="q-field" htmlFor={mfaId}>{t("ui.dialog.mfa")}<input className="q-input q-mono" id={mfaId} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} /></label> : null}
    <p className="q-muted">✓ {finalCheckLabel ?? t("ui.dialog.finalCheck")}</p>{correlationId ? <p className="q-muted q-mono">Correlation ID: {correlationId}</p> : null}{error ? <InlineAlert tone="danger" title={t("ui.dialog.failed")}>{t("ui.dialog.retry")}</InlineAlert> : null}
    <div className="q-dialog-actions"><Dialog.Close asChild><button className="q-button q-button--default" type="button" ref={cancelRef} disabled={pending}>{t("ui.dialog.cancel")}</button></Dialog.Close><Button type="button" variant="danger" disabled={!valid} loading={pending} onClick={() => void submit()}>{confirmLabel}</Button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
