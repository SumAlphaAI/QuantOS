"use client";

import { useEffect, useRef, useState } from "react";
import { createIdentityAction, IdentityActionError } from "../../src/identity/action";

export function useIdentityAction() {
  const action = useRef<ReturnType<typeof createIdentityAction> | null>(null);
  const mounted = useRef(false), submitting = useRef(false);
  const [pending, setPending] = useState(false), [online, setOnline] = useState(true);
  const [error, setError] = useState(""), [uncertain, setUncertain] = useState(false), [remaining, setRemaining] = useState(0);
  useEffect(() => {
    mounted.current = true;
    const current = createIdentityAction({ online: () => navigator.onLine }); action.current = current;
    function sync() { setOnline(navigator.onLine); if (!navigator.onLine) current.cancel(); }
    sync(); window.addEventListener("online", sync); window.addEventListener("offline", sync);
    const timer = setInterval(() => setRemaining(current.remaining()), 250);
    return () => { mounted.current = false; current.close(); action.current = null; clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  return {
    pending, online, error, uncertain, remaining,
    disabled: pending || !online || uncertain || remaining > 0,
    acknowledgeRetry() { action.current?.acknowledgeRetry(); setUncertain(false); setError(""); },
    async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
      const current = action.current;
      // The controller acquires its lock synchronously before the first await.
      if (!current || submitting.current || pending || uncertain || current.remaining() > 0 || !navigator.onLine) return;
      submitting.current = true; setPending(true); setError("");
      try { const result = await current.run(operation); return mounted.current ? result : undefined; }
      catch (reason) { if (mounted.current) { setError(reason instanceof IdentityActionError ? reason.message : "暂时无法完成请求。"); setUncertain(reason instanceof IdentityActionError && reason.outcomeUnknown); } }
      finally { submitting.current = false; if (mounted.current) { setPending(false); setRemaining(current.remaining()); } }
    },
  };
}
