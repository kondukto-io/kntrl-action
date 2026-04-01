/**
 * rules.ts — Generate the kntrl rules directory from action inputs.
 *
 * This module replaces ~180 lines of bash (echo/cat + python JSON→YAML) from the
 * old composite action. It builds a typed JavaScript object representing the full
 * rules.yaml structure, then serializes it using the `yaml` library.
 *
 * The generated rules directory contains:
 *   - rules.yaml          — Main policy file consumed by the kntrl agent
 *   - supply_chain.rego   — OPA Rego rules for advanced supply-chain protection (optional)
 *   - <custom>.rego       — User-provided Rego files (optional)
 *
 * Each rule section (network, process, dns, file) is only included if at least one
 * of its defaults is enabled or the user provided override inputs.
 */
import { ActionInputs } from "./inputs";
/**
 * Build the /tmp/kntrl-rules directory with rules.yaml and optional Rego files.
 * Returns the directory path to pass to the kntrl daemon's --rules-dir flag.
 */
export declare function buildRulesDir(inputs: ActionInputs): string;
