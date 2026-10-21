# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-callback.spec.ts >> OIDC callback PoC >> 完整流：login → PKCE authorize → callback 交换 → 安全 return path
- Location: tests/e2e/auth-callback.spec.ts:40:7

# Error details

```
TimeoutError: browserType.launch: Timeout 180000ms exceeded.
Call log:
  - <launching> /Users/anray/Library/Caches/ms-playwright/firefox-1538/firefox/Nightly.app/Contents/MacOS/firefox -no-remote -headless -profile /var/folders/k8/_4hymb6j59s0c8xntb11ktmc0000gn/T/playwright_firefoxdev_profile-hEFU60 -juggler-pipe -silent
  - <launched> pid=95246
  - [pid=95246][err] *** You are running in headless mode.
  - [pid=95246][err] sandbox_extension_issue_file_to_process failed for /Users/anray/Library/Caches/ms-playwright/firefox-1538/firefox/Nightly.app/Contents/MacOS/plugin-container.app: 1 (Operation not permitted)
  - [pid=95246][out] Crash Annotation GraphicsCriticalError: |[0][GFX1-]: RenderCompositorSWGL failed mapping default framebuffer, no dt (t=5.56815) [GFX1-]: RenderCompositorSWGL failed mapping default framebuffer, no dt

```