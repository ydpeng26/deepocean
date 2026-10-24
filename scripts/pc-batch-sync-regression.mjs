// The shared harness preserves the pinned historical diagnosis by default;
// this entry point explicitly verifies the current repaired working source.
process.argv.push('--fixed');
await import('./pc-batch-sync-diagnosis.mjs');
