/**
 * defaults.ts — Built-in security rule data shipped with the action.
 *
 * These constants replace the old .txt files (network_hosts.txt, process_rules.txt, etc.)
 * that were read at runtime by the bash composite action. By embedding them as typed
 * constants we get compile-time safety, easier maintenance, and no filesystem dependency.
 *
 * Each constant is used by rules.ts when the corresponding "enable_default_*" input is true.
 * User-supplied extras (from action inputs) are appended after these defaults.
 */
/** Hostnames allowed by default for outbound connections (package registries, GitHub, CDNs). */
export declare const DEFAULT_NETWORK_HOSTS: string[];
/** RFC 1918 private ranges — always included when default network rules are on. */
export declare const DEFAULT_NETWORK_IPS: string[];
/** A network profile restricts a specific process to only connect to its expected hosts. */
export interface NetworkProfile {
    process: string;
    allowed_hosts: string[];
}
/**
 * Default per-process network profiles.
 * When active, npm/node may only reach npm registries, pip/python may only reach PyPI.
 * This prevents supply-chain attacks where a compromised package phones home to an
 * unexpected domain.
 */
export declare const DEFAULT_NETWORK_PROFILES: NetworkProfile[];
/** A blocked chain defines a process that should be denied when spawned by certain ancestors. */
export interface BlockedChain {
    process: string;
    ancestors: string[];
}
/**
 * Default blocked process chains.
 * These catch classic supply-chain attack patterns:
 *   - npm postinstall scripts spawning curl/wget (data exfiltration)
 *   - pip setup.py spawning network tools
 *   - Package managers launching unexpected interpreters (python from npm, etc.)
 *   - Netcat/socat from any package manager context
 */
export declare const DEFAULT_BLOCKED_CHAINS: BlockedChain[];
/** Executables blocked unconditionally regardless of ancestry (dangerous tools). */
export declare const DEFAULT_BLOCKED_EXECUTABLES: string[];
/** DNS servers allowed by default (Google Public DNS + Cloudflare). */
export declare const DEFAULT_DNS_SERVERS: string[];
/** File paths monitored for reads (credential files, auth configs, cloud secrets). */
export declare const DEFAULT_FILE_MONITORED_PATHS: string[];
/** File paths protected from writes (system security files that should never be modified). */
export declare const DEFAULT_FILE_PROTECTED_PATHS: string[];
/** Environment variables monitored for access (secrets, tokens, credentials). */
export declare const DEFAULT_FILE_ENV_VARS: string[];
