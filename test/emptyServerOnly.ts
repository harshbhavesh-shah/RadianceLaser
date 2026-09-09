// vitest.config.ts aliases the "server-only" package to this file. That
// package's real implementation unconditionally throws unless Next's
// bundler resolves its special "react-server" export condition, which
// plain Node/Vitest never does — so every "use server"-only module
// (lib/db/*.ts, lib/session.ts, etc.) would throw on import in tests
// otherwise, even though the actual thing under test has nothing to do
// with the client/server boundary the marker package exists to enforce.
export {};
