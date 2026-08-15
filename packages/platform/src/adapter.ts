/**
 * Platform adapters for the shared Terminal. Web and desktop share the same
 * application code; only these capability surfaces differ. Desktop is a thin
 * Tauri adapter over the same models.
 */

import type { PlatformKind } from "./index.js";
export type { PlatformKind } from "./index.js";

export interface PlatformCapabilities {
  kind: PlatformKind;
  /** Desktop prefers the system browser for OIDC and returns via deep link. */
  authFlow: "browser_redirect" | "system_browser_deep_link";
  /** Desktop may raise OS notifications for high-priority queue items. */
  notifications: "browser" | "os_native";
  /** Desktop supports controlled local file import (scan -> artifact first). */
  localFileImport: boolean;
  deepLinkScheme: string;
}

export function platformCapabilities(kind: PlatformKind): PlatformCapabilities {
  if (kind === "desktop") {
    return {
      kind,
      authFlow: "system_browser_deep_link",
      notifications: "os_native",
      localFileImport: true,
      deepLinkScheme: "quantos://auth/callback",
    };
  }
  return {
    kind,
    authFlow: "browser_redirect",
    notifications: "browser",
    localFileImport: false,
    deepLinkScheme: "https://app.sumalpha.ai/auth/callback",
  };
}

export interface AuthCallbackBinding {
  scheme: string;
  /** Tokens never appear in URLs; the callback only carries an exchange code. */
  carriesTokensInUrl: false;
}

export function bindAuthCallback(kind: PlatformKind): AuthCallbackBinding {
  const capabilities = platformCapabilities(kind);
  return {
    scheme: capabilities.deepLinkScheme,
    carriesTokensInUrl: false,
  };
}

/** P17 is a Web capability surface and must not appear in the Desktop shell. */
export function shouldExposeBrowserSettings(kind: PlatformKind): boolean {
  return kind === "web";
}
