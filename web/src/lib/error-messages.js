const MESSAGES = {
  // Event lifecycle
  event_finalized:    "Este evento ya fue finalizado, no se le pueden hacer más cambios.",
  already_finalized:  "Este evento ya estaba finalizado.",
  not_finalized:      "El evento ya está activo.",
  balance_not_zero:   "Hay balances pendientes. Salda todo antes de finalizar el evento.",

  // Authorization
  forbidden:          "No tienes permisos para hacer esto.",
  unauthenticated:    "Necesitas iniciar sesión para continuar.",

  // Generic
  not_found:          "No encontramos lo que buscabas.",
  invalid_id:         "El identificador no es válido.",
  invalid_json:       "Datos inválidos.",
  request_failed:     "Algo salió mal. Intenta de nuevo.",

  // Expense validation
  description_required:    "Necesitas escribir una descripción.",
  description_too_long:    "La descripción es demasiado larga.",
  amount_invalid:          "El monto no es válido.",
  date_invalid:            "La fecha no es válida.",
  payers_required:         "Debes indicar al menos un pagador.",
  payer_invalid:           "Hay un pagador inválido.",
  payer_duplicated:        "Un participante aparece dos veces como pagador.",
  payer_amount_invalid:    "El monto de un pagador no es válido.",
  payers_sum_mismatch:     "La suma de los pagadores no coincide con el total.",
  splits_required:         "Debes indicar entre quiénes se reparte.",
  split_invalid:           "Hay un participante inválido en el reparto.",
  split_duplicated:        "Un participante aparece repetido en el reparto.",
  participant_not_in_event: "Hay un participante que no pertenece a este evento.",

  // Movement validation
  invalid_type:            "El tipo de movimiento no es válido.",
  sender_invalid:          "El remitente no es válido.",
  recipient_invalid:       "El destinatario no es válido.",
  sender_equals_recipient: "El remitente y el destinatario no pueden ser la misma persona.",
  bank_too_long:           "El nombre del banco es demasiado largo.",

  // Join
  event_not_found:    "Ese código no corresponde a ningún viaje.",
  invalid_code:       "El código tiene un formato inválido.",

  // Participants
  invalid_participant: "El participante no es válido.",
  invalid_type_param:  "Tipo de participante inválido.",
  name_required:       "Necesitas escribir un nombre.",
  name_too_long:       "El nombre es demasiado largo.",
};

/**
 * Translates a server-side error code to a user-facing Spanish message.
 *
 * The fallback is returned when the code is missing/empty or when no entry
 * exists in the map. Callers typically pass a context-specific fallback so
 * that unknown server codes still produce a sensible message (e.g.
 * `translateError(err.error, "No pudimos registrar el gasto.")`).
 *
 * @param {string | null | undefined} code - The error code returned by the API
 *   (e.g. `"event_finalized"`, `"payers_sum_mismatch"`).
 * @param {string} [fallback="Algo salió mal. Intenta de nuevo."] - Message
 *   returned when the code is unknown or empty.
 * @returns {string} - A human-readable Spanish message, always non-empty.
 *
 * @example
 * translateError("event_finalized");
 * // "Este evento ya fue finalizado, no se le pueden hacer más cambios."
 *
 * @example
 * translateError("payers_sum_mismatch", "No pudimos guardar el gasto.");
 * // "La suma de los pagadores no coincide con el total."
 *
 * @example
 * translateError("unknown_code", "No pudimos guardar el gasto.");
 * // "No pudimos guardar el gasto."  (falls back when code isn't in the map)
 */
export function translateError(code, fallback = "Algo salió mal. Intenta de nuevo.") {
  if (!code) return fallback;
  return MESSAGES[code] ?? fallback;
}
