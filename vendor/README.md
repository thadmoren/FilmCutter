# Vendored ffmpeg.wasm

Used by **Export clips** to cut plays out of the game file in the browser. Served from
this site rather than a CDN because browsers only start a module worker from the
page's own origin.

- `ffmpeg/` — `@ffmpeg/ffmpeg` 0.12.15, `dist/esm` (MIT, https://github.com/ffmpegwasm/ffmpeg.wasm)
- `ffmpeg-core/` — `@ffmpeg/core` 0.12.10, `dist/esm` (GPL-2.0-or-later; FFmpeg
  builds with GPL components. Source: https://github.com/ffmpegwasm/ffmpeg.wasm and
  https://ffmpeg.org)

To update: `npm pack @ffmpeg/ffmpeg@<v> @ffmpeg/core@<v>`, copy the same files out of
each `dist/esm`, and re-test an export.
