# Fixed server-only JPEG decoder

Approved server vendor direction: user approval following PORTRAIT-JPEG-PATH-1.
Upstream: jpeg-js tag v0.4.4, commit `9ccd35fb5f55a6c4f1902ac5b0f270f675750c27`.
Original `lib/decoder.js`: 40,593 bytes; SHA256 `a3f175fd6f62d142aad94d3bd90f3a30be4e076baf9b6a6fa31c8e84d9d4aa9f`.
[Immutable source](https://raw.githubusercontent.com/jpeg-js/jpeg-js/9ccd35fb5f55a6c4f1902ac5b0f270f675750c27/lib/decoder.js).

The original copyright/Apache-2.0 header is retained. Full [Apache-2.0](LICENSE-Apache-2.0.txt) and upstream package [BSD-3-Clause](LICENSE-BSD-3-Clause.txt) licenses accompany this file. The pinned upstream root listing has no NOTICE file. This is a third-party source dependency, not covered by the project's MIT license and not an npm runtime installation.

Local modifications to `decoder.js`:

- CommonJS/browser export replaced with ESM export; no browser/global installation.
- Bound entropy/stuffed-byte reads; do not skip unconsumed entropy bytes after expected MCUs.
- Require all-one padding, completed progressive runs, exact restart order/count and no terminal extra RST.
- Single-component last restart interval stops at the remaining MCU count.
- Reject illegal sequential EOB and coefficient runs overflowing spectral bounds; enforce 8-bit quantized coefficient ranges before IDCT arithmetic.
- No IDCT constants/rounding, color conversion, or upsampling changed.

**Only** `server/portraitjpeg.js` may supply validated byte-array input with explicit dimensions/scan/table/segment/memory limits. Upstream tolerant defaults and raw public decode calls are not application APIs. Synchronous memory accounting is not an OS/process isolate, hard RSS limit, wall-clock watchdog, or full JPEG conformance/security certification. Do not import into the player Web bundle.

Git attributes preserve decoder and license bytes (`-text`) and exempt only their imported end-of-line whitespace. This retains source/notice hashes on checkout without disabling textual review or repository-wide whitespace checks.
