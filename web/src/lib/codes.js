import { randomInt } from "node:crypto";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 8;

export function generateEventCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[randomInt(0, CHARSET.length)];
  }
  return code;
}
