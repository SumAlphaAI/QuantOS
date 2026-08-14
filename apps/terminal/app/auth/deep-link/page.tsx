"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authorizeDeepLinkTarget } from "../../../src/auth/deep-link";

function DeepLinkAuthorizationGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? "http://localhost:4010";
        const response = await fetch(`${baseUrl}/v1/session`, {
          credentials: "include",
          headers: { accept: "application/json" },
        });
        if (!active) return;
        const decision = authorizeDeepLinkTarget(searchParams.get("return_to"), response.status);
        if (decision.kind === "allow" || decision.kind === "login") {
          router.replace(decision.route);
        } else {
          setError("暂时无法验证会话。未打开目标页面，请稍后重试。");
        }
      } catch {
        if (active) setError("暂时无法验证会话。未打开目标页面，请稍后重试。");
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <main data-smoke="route-/auth/deep-link" style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      {error ? <p role="alert">{error}</p> : <p>正在重新验证会话与页面权限…</p>}
    </main>
  );
}

export default function DeepLinkPage() {
  return (
    <Suspense>
      <DeepLinkAuthorizationGate />
    </Suspense>
  );
}
