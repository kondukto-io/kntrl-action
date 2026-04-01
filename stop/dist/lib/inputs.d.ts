/**
 * inputs.ts — Parse and validate all GitHub Action inputs.
 *
 * Maps the 23 action.yml inputs into a strongly-typed ActionInputs object.
 * Handles three input formats:
 *   - Boolean strings ("true"/"false") → parseBool()
 *   - Comma-separated lists → parseCSV()
 *   - JSON arrays (network_profiles, extra_blocked_chains) → parseJSON()
 *
 * Fallback defaults match action.yml so the action works even if core.getInput()
 * returns empty (e.g. when testing locally without INPUT_ env vars).
 */
import { BlockedChain, NetworkProfile } from "./defaults";
/** Strongly-typed representation of every action input. */
export interface ActionInputs {
    mode: string;
    kntrlVersion: string;
    apiUrl: string;
    apiKey: string;
    enableDefaultNetworkRules: boolean;
    enableDefaultProcessRules: boolean;
    enableDefaultDnsRules: boolean;
    enableDefaultFileRules: boolean;
    enableDefaultSupplyChainRego: boolean;
    allowedHosts: string[];
    allowedIps: string[];
    allowLocalRanges: boolean;
    allowGithubMeta: boolean;
    allowMetadata: boolean;
    extraBlockedExecutables: string[];
    extraMonitoredPaths: string[];
    extraProtectedPaths: string[];
    extraMonitoredEnvVars: string[];
    customRulesFile: string;
    customRulesDir: string;
    customRegoFile: string;
    networkProfiles: NetworkProfile[];
    extraBlockedChains: BlockedChain[];
}
/**
 * Read all action inputs from the GitHub Actions runtime environment.
 * Each input has a fallback default that mirrors action.yml, so the code
 * works correctly both in CI and during local testing.
 */
export declare function getInputs(): ActionInputs;
