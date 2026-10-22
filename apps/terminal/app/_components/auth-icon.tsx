export function AuthIcon({ kind }: { kind: "shield" | "audit" | "paper" | "offline" | "denied" | "mfa" | "access" }) {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(["shield", "denied", "mfa"].includes(kind)) ? <><path d="M20 4 33 9v11c0 8-8 14-13 16C15 34 7 28 7 20V9Z" />{kind === "denied" ? <path d="m15 15 10 10m0-10L15 25" /> : kind === "mfa" ? <path d="m13 20 5 5 10-12" /> : null}</> : null}
    {kind === "audit" || kind === "paper" ? <><path d="M22 5H8v30h15M22 5v9h9V14ZM13 19h8m-8 6h5" />{kind === "audit" ? <><circle cx="28" cy="27" r="6" /><path d="m32 32 5 5" /></> : <><circle cx="29" cy="29" r="7" /><path d="m24 24 10 10" /></>}</> : null}
    {kind === "offline" ? <><path d="M10 29a8 8 0 0 1 1-16 11 11 0 0 1 20-2m3 6a7 7 0 0 1-1 13H19M6 35 35 5" /></> : null}
    {kind === "access" ? <><circle cx="17" cy="11" r="6" /><path d="M6 33v-4c0-6 22-6 22 0v4H6m26-19v12m-6-6h12" /></> : null}
  </svg>;
}
