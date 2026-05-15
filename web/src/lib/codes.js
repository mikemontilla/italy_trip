import { randomInt } from "node:crypto";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 8;

/**
 * Generates a random 8-character event code using A–Z and 0–9.
 *
 * Uses Node's cryptographic RNG (`crypto.randomInt`) — not `Math.random()` —
 * because the code is the access token to an event: anyone with it can join.
 * A predictable PRNG would let an attacker enumerate other people's trips.
 *
 * This function only generates; uniqueness against existing rows is enforced
 * by `events.createEvent` (which retries on `ER_DUP_ENTRY`) and the
 * `UNIQUE KEY` on `events.code`.
 *
 * @returns {string} - 8 uppercase alphanumeric characters, e.g. `"A1B2C3D4"`.
 *
 * @example
 * generateEventCode(); // "K7QM93XB"
 */
export function generateEventCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[randomInt(0, CHARSET.length)];
  }
  return code;
}
