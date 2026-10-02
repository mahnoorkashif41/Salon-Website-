export const BOOKINGS_STORAGE_KEY = 'elan_beauty_studio_mvp'
export const BOOKING_CONFLICT_MESSAGE = 'That time was just booked. Please select another time.'

function getStorage(storage) {
  const target = storage ?? globalThis.localStorage
  if (!target) throw new Error('Local storage is not available in this browser.')
  return target
}

export function readLocalBookings(storage) {
  const target = getStorage(storage)
  const raw = target.getItem(BOOKINGS_STORAGE_KEY)
  if (!raw) return []
  const parsed = JSON.parse(raw)
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.bookings)) return parsed.bookings
  throw new Error('Saved bookings have an unsupported format.')
}

export function getLocalBookingsForRange(fromDate, toDate, storage) {
  return readLocalBookings(storage).filter((booking) =>
    booking.booking_date >= fromDate
    && booking.booking_date <= toDate
    && ['pending', 'confirmed'].includes(booking.status)
  )
}

function minutes(time) {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

export function saveLocalBooking(details, storage) {
  const target = getStorage(storage)
  const bookings = readLocalBookings(target)
  const overlaps = bookings.some((booking) => (
    booking.booking_date === details.booking_date
    && ['pending', 'confirmed'].includes(booking.status)
    && minutes(details.start_time) < minutes(booking.end_time)
    && minutes(booking.start_time) < minutes(details.end_time)
  ))
  if (overlaps) throw new Error(BOOKING_CONFLICT_MESSAGE)

  const id = globalThis.crypto?.randomUUID?.()
    ?? `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const booking = {
    ...details,
    id,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  }
  target.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify({ bookings: [...bookings, booking] }))
  return booking
}
