export const salonSchedule = {
  timezone: 'Asia/Karachi',
  weekdays: [1, 2, 3, 4, 5, 6],
  opensAt: 10 * 60,
  lunchStartsAt: 13 * 60,
  lunchEndsAt: 14 * 60,
  closesAt: 19 * 60,
  interval: 30,
}

function getLahoreNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: salonSchedule.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function dateToLocalValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getSalonDates(daysAhead = 90) {
  const [year, month, day] = getLahoreNow().date.split('-').map(Number)
  const today = new Date(year, month - 1, day, 12)
  const dates = []
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    if (salonSchedule.weekdays.includes(date.getDay())) dates.push(date)
  }
  return dates
}

export function getScheduledStartTimes(duration, dateValue) {
  const durationMinutes = Number(duration)
  if (!durationMinutes || !dateValue) return []

  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  if (!salonSchedule.weekdays.includes(date.getDay())) return []
  const now = getLahoreNow()
  const times = []

  for (let start = salonSchedule.opensAt; start + durationMinutes <= salonSchedule.closesAt; start += salonSchedule.interval) {
    const end = start + durationMinutes
    const overlapsLunch = start < salonSchedule.lunchEndsAt && end > salonSchedule.lunchStartsAt
    if (overlapsLunch) continue
    if (dateValue === now.date && start <= now.minutes) continue
    times.push({ value: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`, end })
  }
  return times
}

const blockingStatuses = new Set(['pending', 'confirmed'])

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function isBlockingBooking(status) {
  return blockingStatuses.has(status)
}

export function filterAvailableStartTimes(slots, bookings) {
  const blockingBookings = bookings.filter((booking) => isBlockingBooking(booking.status))
  return slots.filter((slot) => {
    const start = timeToMinutes(slot.value)
    const end = slot.end ?? start
    return !blockingBookings.some((booking) => {
      const bookingStart = timeToMinutes(booking.start_time)
      const bookingEnd = timeToMinutes(booking.end_time)
      return start < bookingEnd && bookingStart < end
    })
  })
}

export function getEndTime(startValue, duration) {
  const [hours, minutes] = startValue.split(':').map(Number)
  const end = hours * 60 + minutes + Number(duration)
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

export function formatTime(value) {
  const [hours, minutes] = value.split(':').map(Number)
  const date = new Date(2000, 0, 1, hours, minutes)
  return new Intl.DateTimeFormat('en-PK', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function formatSalonDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
}
