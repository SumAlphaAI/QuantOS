"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "../Button/Button";
import { InlineAlert } from "../InlineAlert/InlineAlert";
import { createThemeVariables, useTheme } from "../../theme/ThemeProvider";

export interface DangerConfirmDialogProps {
  trigger: ReactNode; title: string; summary: string; impact: string; confirmPhrase: string; confirmLabel: string;
  mfaRequired?: boolean; finalCheckLabel?: string; correlationId?: string; onConfirm: (input: { phrase: string; mfaCode?: string }) => Promise<void> | void;
}
export function isDangerConfirmationValid(phrase: string, expectedPhrase: string, mfaRequired: boolean, mfaCode: string): boolean { return phrase === expectedPhrase && (!mfaRequired || /^\d{6}$/.test(mfaCode)); }
export function DangerConfirmDialog({ trigger, title, summary, impact, confirmPhrase, confirmLabel, mfaRequired = false, finalCheckLabel = "服务端最终校验将在提交时再次执行", correlationId, onConfirm }: DangerConfirmDialogProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false); const [phrase, setPhrase] = useState(""); const [mfaCode, setMfaCode] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string>();
  const cancelRef = useRef<HTMLButtonElement>(null); const phraseId = useId(); const mfaId = useId(); const valid = isDangerConfirmationValid(phrase, confirmPhrase, mfaRequired, mfaCode);
  function reset() { setPhrase(""); setMfaCode(""); setError(undefined); }
  async function submit() { if (!valid || pending) return; setPending(true); setError(undefined); try { await onConfirm({ phrase, mfaCode: mfaRequired ? mfaCode : undefined }); setOpen(false); reset(); } catch (reason) { setError(reason instanceof Error ? reason.message : "操作未完成，请重试"); } finally { setPending(false); } }
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (!next) reset(); } }}><Dialog.Trigger asChild>{trigger}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="q-dialog-overlay" /><Dialog.Content className="q-dialog-content quantos-theme" style={createThemeVariables(theme)} onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onInteractOutside={(event) => { if (pending) event.preventDefault(); }}>
    <Dialog.Title className="q-dialog-title">{title}</Dialog.Title><Dialog.Description className="q-dialog-description">{summary}</Dialog.Description>
    <InlineAlert tone="danger" title="不可逆操作警告">{impact}</InlineAlert>
    <label className="q-field" htmlFor={phraseId}>输入“{confirmPhrase}”以确认<input className="q-input" id={phraseId} autoComplete="off" value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label>
    {mfaRequired ? <label className="q-field" htmlFor={mfaId}>MFA 验证码<input className="q-input q-mono" id={mfaId} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} /></label> : null}
    <p className="q-muted">✓ {finalCheckLabel}</p>{correlationId ? <p className="q-muted q-mono">Correlation ID: {correlationId}</p> : null}{error ? <InlineAlert tone="danger" title="提交失败">{error}</InlineAlert> : null}
    <div className="q-dialog-actions"><Dialog.Close asChild><button className="q-button q-button--default" type="button" ref={cancelRef} disabled={pending}>取消</button></Dialog.Close><Button type="button" variant="danger" disabled={!valid} loading={pending} onClick={() => void submit()}>{confirmLabel}</Button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
