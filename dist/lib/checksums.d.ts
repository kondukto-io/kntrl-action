/**
 * checksums.ts — Pinned SHA256 checksums for kntrl binary releases.
 *
 * When a user pins kntrl_version to a known version (e.g. "v0.2.1"), the install
 * step verifies the downloaded binary's SHA256 against this map. This prevents
 * supply-chain attacks where a release binary is tampered with after publication.
 *
 * Structure: { "vX.Y.Z": { "amd64": "<sha256>", "arm64": "<sha256>" } }
 *
 * When adding a new release:
 *   1. Download the binary: curl -fsSL -o kntrl.amd64 https://github.com/kondukto-io/kntrl/releases/download/vX.Y.Z/kntrl.amd64
 *   2. Compute hash:        shasum -a 256 kntrl.amd64
 *   3. Add entry below
 *   4. Rebuild: npm run build
 */
export declare const CHECKSUMS: Record<string, Record<string, string>>;
