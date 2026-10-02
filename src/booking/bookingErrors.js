export const SLOT_TAKEN_MESSAGE = 'This time slot is no longer available. Please select another time.'

export function normalizeBookingError(error) {
  if (error && (error.code === 'P0001' || error.message?.includes(SLOT_TAKEN_MESSAGE))) {
    return new Error(SLOT_TAKEN_MESSAGE)
  }
  return error
}
