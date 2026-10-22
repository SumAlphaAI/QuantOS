# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p01.spec.ts >> C01 access double submit is single-flight and 202 retains audit correlation without granting access
- Location: tests/e2e/ui-p01.spec.ts:16:5

# Error details

```
TimeoutError: browserType.launch: Timeout 180000ms exceeded.
Call log:
  - <launching> /Users/anray/Library/Caches/ms-playwright/firefox-1538/firefox/Nightly.app/Contents/MacOS/firefox -no-remote -headless -profile /var/folders/k8/_4hymb6j59s0c8xntb11ktmc0000gn/T/playwright_firefoxdev_profile-zVvWuh -juggler-pipe -silent
  - <launched> pid=71023
  - [pid=71023][err] *** You are running in headless mode.
  - [pid=71023][err] sandbox_extension_issue_file_to_process failed for /Users/anray/Library/Caches/ms-playwright/firefox-1538/firefox/Nightly.app/Contents/MacOS/plugin-container.app: 1 (Operation not permitted)
  - [pid=71023][out] Crash Annotation GraphicsCriticalError: |[0][GFX1-]: RenderCompositorSWGL failed mapping default framebuffer, no dt (t=1.45886) [GFX1-]: RenderCompositorSWGL failed mapping default framebuffer, no dt

```