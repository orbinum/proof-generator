/**
 * The circuit artifacts this package was built against, as integrity pins.
 *
 * Taken from the `@orbinum/circuits` dependency at build time (see
 * build/pins.ts) and inlined by tsup's `define`. The web provider checks every
 * download — and the vk_hash it reports — against these rather than against
 * the manifest it fetched, which comes from the same source as the artifacts.
 */
import type { ArtifactKind } from './manifest';

/** One circuit version: its on-chain VK hash and the sha256 of each artifact. */
export interface CircuitVersionPin {
  vk_hash: string;
  sha256: Partial<Record<ArtifactKind, string>>;
}

/** Pins by circuit name, then by version number (as a string key). */
export type CircuitsPins = Record<string, Record<string, CircuitVersionPin>>;

declare const __CIRCUITS_PINS__: CircuitsPins;

/** The pins embedded in this build. */
export const CIRCUITS_PINS: CircuitsPins = __CIRCUITS_PINS__;
