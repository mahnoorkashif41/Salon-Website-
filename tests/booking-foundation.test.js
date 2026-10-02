import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { seededServices } from '../src/data/serviceSeeds.js'
import { filterAvailableStartTimes, formatTime, getEndTime, getSalonDates, getScheduledStartTimes, salonSchedule } from '../src/booking/schedule.js'
import { normalizeBookingError, SLOT_TAKEN_MESSAGE } from '../src/booking/bookingErrors.js'
import { BOOKINGS_STORAGE_KEY, BOOKING_CONFLICT_MESSAGE, getLocalBookingsForRange, readLocalBookings, saveLocalBooking } from '../src/booking/bookingRepository.js'

const migration = readFileSync(new URL('../supabase/migrations/202609290002_services_bookings.sql', import.meta.url), 'utf8')
const availabilityMigration = readFileSync(new URL('../supabase/migrations/202609290003_booking_availability.sql', import.meta.url), 'utf8')
const guestMigration = readFileSync(new URL('../supabase/migrations/202610020001_guest_bookings.sql', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const bookingPage = readFileSync(new URL('../src/booking/BookingPage.jsx', import.meta.url), 'utf8')

test('seed service records match the requested salon menu', () => {
  assert.deepEqual(seededServices.map(({ name, duration, price }) => [name, duration, price]), [
    ['Haircut & Styling', 45, 1500],
    ['Hair Treatment', 60, 2500],
    ['Facial', 60, 2000],
    ['Manicure', 45, 1200],
    ['Pedicure', 45, 1500],
    ['Party Makeup', 90, 4000],
    ['Bridal Makeup', 150, 8000],
    ['Hair Styling', 60, 2000],
  ])
  assert.ok(seededServices.every(({ id, description, image, active }) => id && description && image && active))
})

test('salon date list excludes Sundays and starts today or later', () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dates = getSalonDates(60)
  assert.ok(dates.length > 0)
  for (const date of dates) {
    assert.notEqual(date.getDay(), 0)
    assert.ok(date >= today)
  }
})

test('scheduled times fit service length, opening hours, and lunch break', () => {
  const monday = '2030-01-07'
  assert.equal(new Date(`${monday}T12:00:00`).getDay(), 1)
  const slots = getScheduledStartTimes(45, monday)
  assert.ok(slots.length > 0)
  for (const slot of slots) {
    const start = Number(slot.value.slice(0, 2)) * 60 + Number(slot.value.slice(3))
    const end = start + 45
    assert.ok(start >= salonSchedule.opensAt)
    assert.ok(end <= salonSchedule.closesAt)
    assert.ok(!(start < salonSchedule.lunchEndsAt && end > salonSchedule.lunchStartsAt))
  }
  assert.ok(!slots.some((slot) => slot.value.startsWith('13:')))
  assert.equal(getEndTime('16:30', 150), '19:00')
})

test('Sunday has no scheduled start times', () => {
  assert.equal(getScheduledStartTimes(60, '2030-01-06').length, 0)
})

test('pending and confirmed bookings block overlapping start times', () => {
  const slots = [
    { value: '10:00', end: 630 },
    { value: '10:30', end: 660 },
    { value: '11:00', end: 690 },
  ]
  for (const status of ['pending', 'confirmed']) {
    const remaining = filterAvailableStartTimes(slots, [{ start_time: '10:00:00', end_time: '11:00:00', status }])
    assert.deepEqual(remaining.map((slot) => slot.value), ['11:00'], `${status} must block both overlapping slots`)
  }
})

test('scheduled slots remain available when no bookings block them', () => {
  const slots = getScheduledStartTimes(60, '2030-01-07')
  assert.ok(slots.length > 0)
  assert.deepEqual(filterAvailableStartTimes(slots, []), slots)
})

test('cancelled, rejected, and completed bookings release their time', () => {
  const slots = [{ value: '10:00', end: 660 }]
  for (const status of ['cancelled', 'rejected', 'completed']) {
    assert.deepEqual(filterAvailableStartTimes(slots, [{ start_time: '10:00:00', end_time: '11:00:00', status }]), slots)
  }
})

test('partial overlaps are blocked while an appointment ending at the start is available', () => {
  const slots = [
    { value: '10:00', end: 630 },
    { value: '10:30', end: 660 },
    { value: '11:00', end: 690 },
  ]
  const remaining = filterAvailableStartTimes(slots, [{ start_time: '10:15:00', end_time: '10:45:00', status: 'pending' }])
  assert.deepEqual(remaining.map((slot) => slot.value), ['11:00'])
})

test('stale submit errors use the requested customer message', () => {
  assert.equal(normalizeBookingError({ code: 'P0001', message: SLOT_TAKEN_MESSAGE }).message, SLOT_TAKEN_MESSAGE)
  assert.equal(normalizeBookingError({ code: '22023', message: 'Invalid date' }).message, 'Invalid date')
})

test('time labels are formatted for customers', () => {
  assert.match(formatTime('14:00'), /2:00/)
})

test('Supabase migration defines protected services and booking relationships', () => {
  for (const column of ['id uuid', 'name text', 'description text', 'price numeric', 'duration integer', 'image text', 'active boolean', 'created_at timestamptz', 'updated_at timestamptz']) {
    assert.ok(migration.includes(column), `Missing service/booking column definition: ${column}`)
  }
  for (const field of ['customer_id', 'service_id', 'booking_date', 'start_time', 'end_time', 'customer_name', 'customer_phone', 'note']) {
    assert.match(migration, new RegExp(`\\b${field}\\b`))
  }
  for (const status of ['pending', 'confirmed', 'rejected', 'cancelled', 'completed']) {
    assert.ok(migration.includes(`'${status}'`), `Missing booking status: ${status}`)
  }
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /references public\.profiles/i)
  assert.match(migration, /references public\.services/i)
})

test('availability migration checks overlaps under a date transaction lock', () => {
  assert.match(availabilityMigration, /get_blocked_booking_times/i)
  assert.match(availabilityMigration, /returns table \(start_time time without time zone, end_time time without time zone, status text\)/i)
  assert.match(availabilityMigration, /create_booking_if_available/i)
  assert.match(availabilityMigration, /pg_advisory_xact_lock/i)
  assert.match(availabilityMigration, /b\.start_time < v_end_time/i)
  assert.match(availabilityMigration, /b\.end_time > p_start_time/i)
  assert.match(availabilityMigration, /status in \('pending', 'confirmed'\)/i)
  assert.match(availabilityMigration, /revoke insert on table public\.bookings from authenticated/i)
  assert.ok(availabilityMigration.includes(SLOT_TAKEN_MESSAGE))
})

test('guest booking is public and preserves availability and atomic overlap checks', () => {
  assert.match(appSource, /<Route path="\/book" element={<BookingPage \/>} \/>/)
  assert.doesNotMatch(appSource.match(/<Route path="\/book"[^\n]*/)?.[0] ?? '', /ProtectedRoute/)
  assert.match(bookingPage, /customer_email:/)
  assert.match(bookingPage, /type="email" required/)
  assert.match(bookingPage, /type="tel"[^>]*required/)
  assert.match(guestMigration, /alter column customer_id drop not null/i)
  assert.match(guestMigration, /add column if not exists customer_email/i)
  assert.match(guestMigration, /create_guest_booking_if_available/i)
  assert.match(guestMigration, /pg_advisory_xact_lock/i)
  assert.match(guestMigration, /b\.start_time < v_end_time/i)
  assert.match(guestMigration, /b\.end_time > p_start_time/i)
  assert.match(guestMigration, /customer_id, customer_email, service_id, booking_date/i)
  assert.match(guestMigration, /grant execute on function public\.create_guest_booking_if_available[\s\S]*to anon, authenticated/i)
})

test('booking page uses local data and localStorage without Supabase booking calls', () => {
  const page = readFileSync(new URL('../src/booking/BookingPage.jsx', import.meta.url), 'utf8')
  const repository = readFileSync(new URL('../src/booking/bookingRepository.js', import.meta.url), 'utf8')
  assert.match(page, /serviceIds/)
  assert.match(page, /totalDuration/)
  assert.match(page, /booking-calendar/)
  assert.match(page, /getLocalBookingsForRange/)
  assert.match(page, /saveLocalBooking/)
  assert.match(page, /Confirm booking/)
  assert.doesNotMatch(page, /supabase|createGuestBooking|getBlockingBookingsForRange|useServices/)
  assert.doesNotMatch(repository, /supabase|\.rpc\(/)
  assert.match(repository, /JSON\.stringify\(\{ bookings:/)
  assert.match(repository, /BOOKING_CONFLICT_MESSAGE/)
})

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

function sampleLocalBooking(overrides = {}) {
  return {
    service_ids: ['service-a', 'service-b'],
    services: [{ id: 'service-a', name: 'Haircut & Styling', price: 1500, duration: 45 }, { id: 'service-b', name: 'Facial', price: 2000, duration: 60 }],
    booking_date: '2030-01-07',
    start_time: '10:00',
    end_time: '11:45',
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: '+92 300 1234567',
    note: '',
    total_duration: 105,
    total_price: 3500,
    ...overrides,
  }
}

test('local bookings are stored under a bookings array and persist when read again', () => {
  const storage = new MemoryStorage()
  const saved = saveLocalBooking(sampleLocalBooking(), storage)
  const raw = JSON.parse(storage.getItem(BOOKINGS_STORAGE_KEY))
  assert.equal(raw.bookings.length, 1)
  assert.equal(raw.bookings[0].id, saved.id)
  assert.deepEqual(readLocalBookings(storage), [saved])
  assert.deepEqual(getLocalBookingsForRange('2030-01-01', '2030-01-31', storage), [saved])
})

test('local availability reads persisted bookings and excludes conflicting slots', () => {
  const storage = new MemoryStorage()
  const existing = saveLocalBooking(sampleLocalBooking(), storage)
  const blocked = getLocalBookingsForRange('2030-01-07', '2030-01-07', storage)
  const slots = [{ value: '10:00', end: 705 }, { value: '11:30', end: 795 }, { value: '12:00', end: 825 }]
  assert.deepEqual(filterAvailableStartTimes(slots, blocked).map((slot) => slot.value), ['12:00'])
  assert.equal(existing.status, 'confirmed')
})

test('local booking save rechecks overlaps before writing', () => {
  const storage = new MemoryStorage()
  saveLocalBooking(sampleLocalBooking(), storage)
  assert.throws(
    () => saveLocalBooking(sampleLocalBooking({ start_time: '11:00', end_time: '12:00' }), storage),
    { message: BOOKING_CONFLICT_MESSAGE },
  )
  assert.equal(readLocalBookings(storage).length, 1)
})
