/**
 * install.ts — Download, verify, cache, and install the kntrl binary.
 *
 * Flow:
 *   1. Check GitHub Actions tool cache for a previously downloaded binary
 *   2. If not cached, download from github.com/kondukto-io/kntrl/releases
 *   3. Verify SHA256 checksum against pinned hashes in checksums.ts
 *      - Known version + known arch → verify or fail
 *      - "latest" → skip verification with a warning
 *      - Unknown version → skip verification with a warning
 *   4. Install to /usr/local/bin/kntrl (requires sudo)
 *   5. Cache the binary for future workflow runs
 *
 * The download URL is hardcoded to the official GitHub releases endpoint —
 * it is NOT user-controllable, preventing redirect-based attacks.
 */
/**
 * Download and install the kntrl binary for the given version.
 * Returns the installed binary path (/usr/local/bin/kntrl).
 */
export declare function installKntrl(version: string): Promise<string>;
