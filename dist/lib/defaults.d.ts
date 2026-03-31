export declare const DEFAULT_NETWORK_HOSTS: string[];
export declare const DEFAULT_NETWORK_IPS: string[];
export interface NetworkProfile {
    process: string;
    allowed_hosts: string[];
}
export declare const DEFAULT_NETWORK_PROFILES: NetworkProfile[];
export interface BlockedChain {
    process: string;
    ancestors: string[];
}
export declare const DEFAULT_BLOCKED_CHAINS: BlockedChain[];
export declare const DEFAULT_BLOCKED_EXECUTABLES: string[];
export declare const DEFAULT_DNS_SERVERS: string[];
export declare const DEFAULT_FILE_MONITORED_PATHS: string[];
export declare const DEFAULT_FILE_PROTECTED_PATHS: string[];
export declare const DEFAULT_FILE_ENV_VARS: string[];
