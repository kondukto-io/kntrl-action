import { BlockedChain, NetworkProfile } from "./defaults";
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
export declare function getInputs(): ActionInputs;
