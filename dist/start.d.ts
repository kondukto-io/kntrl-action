/**
 * start.ts — Main entry point for the kntrl GitHub Action (start step).
 *
 * This is the file compiled by ncc into dist/index.js and referenced
 * by action.yml's `runs.main` field.
 *
 * Execution flow:
 *   1. Parse all action inputs into a typed object
 *   2. Download and install the kntrl binary (with SHA256 verification)
 *   3. Generate the rules directory (rules.yaml + optional Rego files)
 *   4. Start the kntrl eBPF agent as a background daemon
 *   5. Export the report file path as an action output
 *
 * The daemon stays running in the background while subsequent workflow steps
 * execute. It is stopped later by the stop action (stop/action.yml).
 */
export {};
