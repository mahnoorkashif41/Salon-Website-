import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { seededServices } from '../data/serviceSeeds.js'
import { BOOKING_CONFLICT_MESSAGE, getLocalBookingsForRange, saveLocalBooking } from './bookingRepository.js'
import { dateToLocalValue, formatSalonDate, formatTime, getEndTime, getScheduledStartTimes, salonSchedule, filterAvailableStartTimes } from './schedule.js'
import './booking.css'

const stepLabels = ['Services', 'Date', 'Time', 'Details', 'Review']
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthFormatter = new Intl.DateTimeFormat('en-PK', { month: 'long', year: 'numeric' })

const formatPrice = (price) => `Rs. ${Number(price).toLocaleString('en-PK')}`

function salonToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: salonSchedule.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12)
}
function valueForDate(year, month, day) { return dateToLocalValue(new Date(year, month, day, 12)) }
function groupBookings(rows) { return rows.reduce((result, row) => { (result[row.booking_date] ||= []).push(row); return result }, {}) }

function BookingPage() {
  const [searchParams] = useSearchParams()
  const services = seededServices
  const [step, setStep] = useState(1)
  const [serviceIds, setServiceIds] = useState(() => searchParams.get('service') ? [searchParams.get('service')] : [])
  const [bookingDate, setBookingDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [formError, setFormError] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [blockedByDate, setBlockedByDate] = useState({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const today = useMemo(salonToday, [])
  const lastDay = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 90); return d }, [today])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12))
  const chosenServices = services.filter((service) => serviceIds.includes(service.id))
  const totalDuration = chosenServices.reduce((sum, service) => sum + Number(service.duration), 0)
  const totalPrice = chosenServices.reduce((sum, service) => sum + Number(service.price), 0)
  const from = valueForDate(month.getFullYear(), month.getMonth(), 1)
  const to = valueForDate(month.getFullYear(), month.getMonth() + 1, 0)
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1, 12).getDay() + 6) % 7
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstWeekday + monthDays) / 7) * 7 }, (_, i) => {
    const day = i - firstWeekday + 1
    return day > 0 && day <= monthDays ? new Date(month.getFullYear(), month.getMonth(), day, 12) : null
  })
  const blocked = blockedByDate[bookingDate] || []
  const timeOptions = useMemo(() => filterAvailableStartTimes(getScheduledStartTimes(totalDuration, bookingDate), blocked), [totalDuration, bookingDate, blocked])

  useEffect(() => {
    const todayValue = dateToLocalValue(today)
    const lastValue = dateToLocalValue(lastDay)
    const queryFrom = from < todayValue ? todayValue : from
    const queryTo = to > lastValue ? lastValue : to
    setAvailabilityLoading(true)
    setAvailabilityError('')
    try {
      const bookings = queryFrom <= queryTo ? getLocalBookingsForRange(queryFrom, queryTo) : []
      setBlockedByDate(groupBookings(bookings))
    } catch (error) {
      setBlockedByDate({})
      setAvailabilityError(error.message || 'Saved bookings could not be read from this browser.')
    } finally {
      setAvailabilityLoading(false)
    }
  }, [from, to, today, lastDay, refresh])

  useEffect(() => {
    const refreshFromStorage = () => setRefresh((value) => value + 1)
    window.addEventListener('storage', refreshFromStorage)
    return () => window.removeEventListener('storage', refreshFromStorage)
  }, [])

  function advance(target) { setFormError(''); setStep(target); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function toggleService(id) {
    setServiceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setBookingDate('')
    setStartTime('')
    setFormError('')
  }
  function dateCanBook(date) {
    if (!date || availabilityLoading || availabilityError || !chosenServices.length) return false
    const value = dateToLocalValue(date)
    if (value < dateToLocalValue(today) || value > dateToLocalValue(lastDay) || !salonSchedule.weekdays.includes(date.getDay())) return false
    const dayBlocks = blockedByDate[value] || []
    return filterAvailableStartTimes(getScheduledStartTimes(totalDuration, value), dayBlocks).length > 0
  }
  function moveMonth(offset) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12))
    setBookingDate('')
    setStartTime('')
  }
  function validateDetails(event) {
    event.preventDefault()
    const cleanEmail = email.trim()
    const cleanPhone = phone.trim()
    if (name.trim().length < 2 || name.trim().length > 100 || !cleanEmail || !cleanPhone) { setFormError('Enter your name, email address, and phone number.'); return }
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setFormError('Enter a valid email address.'); return }
    const digits = cleanPhone.replace(/\D/g, '')
    if (!/^[+0-9() -]{7,20}$/.test(cleanPhone) || digits.length < 7 || digits.length > 15) { setFormError('Enter a valid phone number.'); return }
    advance(5)
  }
  function submitBooking() {
    if (!chosenServices.length || !bookingDate || !timeOptions.some((slot) => slot.value === startTime)) return
    setSubmitting(true)
    setBookingError('')
    try {
      const booking = saveLocalBooking({
        service_ids: chosenServices.map((service) => service.id),
        services: chosenServices.map(({ id, name: serviceName, price, duration }) => ({ id, name: serviceName, price, duration })),
        booking_date: bookingDate,
        start_time: startTime,
        end_time: getEndTime(startTime, totalDuration),
        customer_name: name.trim(),
        customer_email: email.trim().toLowerCase(),
        customer_phone: phone.trim(),
        note: note.trim(),
        total_duration: totalDuration,
        total_price: totalPrice,
      })
      setReference(booking.id)
      setComplete(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setBookingError(error.message || 'This browser could not save your booking.')
      if (error.message === BOOKING_CONFLICT_MESSAGE) setRefresh((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const endTime = startTime ? getEndTime(startTime, totalDuration) : ''
  if (complete) return <main className="booking-page"><section className="booking-success">
    <div className="success-check"><Check size={25} /></div><span className="eyebrow">BOOKING CONFIRMED</span>
    <h1>Your visit is<br /><em>in good hands.</em></h1><p>Your booking has been saved in this browser. Keep this device and browser data to retain the confirmation.</p>
    <div className="booking-success-summary"><strong>{chosenServices.map((service) => service.name).join(', ')}</strong><span>{formatSalonDate(bookingDate)}</span><span>{formatTime(startTime)} to {formatTime(endTime)}</span><span>{totalDuration} minutes / {formatPrice(totalPrice)}</span><span>{name}</span><span>{email.trim().toLowerCase()}</span><span>{phone}</span>{note && <span>{note}</span>}{reference && <small>Reference {String(reference).slice(0, 8).toUpperCase()}</small>}</div>
    <Link to="/services" className="button button-dark">Browse services <ArrowRight size={15} /></Link>
  </section></main>

  return <main className="booking-page booking-page-redesigned">
    <div className="booking-intro"><Link to="/services" className="back-link"><ArrowLeft size={14} /> Our services</Link><span className="eyebrow">YOUR ELAN APPOINTMENT</span><h1>Make a little<br /><em>time for you.</em></h1><p>Select your services and a date. Available times reflect the combined appointment length.</p></div>
    <div className="booking-layout">
      <section className="booking-main" aria-label="Appointment details">
        <nav className="booking-steps" aria-label="Booking steps">{stepLabels.map((label, i) => <button type="button" key={label} className={`booking-step ${step === i + 1 ? 'current' : ''} ${step > i + 1 ? 'done' : ''}`} onClick={() => i + 1 < step && advance(i + 1)} disabled={i + 1 >= step}><span>{step > i + 1 ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</span><small>{label}</small></button>)}</nav>
        <div className="booking-panel">
          {step === 1 && <><div className="booking-panel-title"><span className="eyebrow">STEP 01</span><h2>Choose your<br /><em>treatments.</em></h2><p className="booking-subtitle">Select one or more services. The appointment will include time for each selection.</p></div>
            <div className="booking-service-options">{services.map((service) => { const selected = serviceIds.includes(service.id); return <button type="button" key={service.id} aria-pressed={selected} className={`booking-service-option ${selected ? 'selected' : ''}`} onClick={() => toggleService(service.id)}>
              <img src={service.image} alt="" /><span className="booking-service-name"><strong>{service.name}</strong><small><Clock3 size={13} /> {service.duration} min</small></span><span className="booking-service-price">{formatPrice(service.price)}</span><span className="booking-check">{selected && <Check size={15} />}</span>
            </button> })}</div>
            {formError && <p className="booking-form-error" role="alert">{formError}</p>}
            <div className="booking-selection-total"><span>{chosenServices.length} {chosenServices.length === 1 ? 'service' : 'services'} / {totalDuration} min</span><strong>{formatPrice(totalPrice)}</strong></div>
            <button className="button button-dark booking-next" type="button" onClick={() => chosenServices.length ? advance(2) : setFormError('Choose at least one service to continue.')} disabled={!chosenServices.length}>Choose a date <ArrowRight size={15} /></button>
          </>}

          {step === 2 && <><div className="booking-panel-title"><span className="eyebrow">STEP 02 / {totalDuration} MINUTES</span><h2>Choose a<br /><em>day to visit.</em></h2></div>
            {availabilityError && <div className="booking-form-error" role="alert">Availability could not be loaded: {availabilityError} <button type="button" className="availability-retry" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}
            <div className="calendar-header"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} disabled={month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()}><ChevronLeft size={19} /></button><h3>{monthFormatter.format(month)}</h3><button type="button" aria-label="Next month" onClick={() => moveMonth(1)} disabled={new Date(month.getFullYear(), month.getMonth() + 1, 1) > new Date(lastDay.getFullYear(), lastDay.getMonth(), 1)}><ChevronRight size={19} /></button></div>
            <div className="booking-calendar"><div className="calendar-weekdays">{weekdayLabels.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((date, index) => {
              if (!date) return <span className="calendar-empty" key={'empty-' + index} />
              const value = dateToLocalValue(date); const selectable = dateCanBook(date); const selected = value === bookingDate
              return <button type="button" key={value} className={`calendar-day ${selected ? 'selected' : ''} ${selectable ? '' : 'unavailable'}`} disabled={!selectable} aria-pressed={selected} aria-label={value} onClick={() => { setBookingDate(value); setStartTime(''); setFormError('') }}>{date.getDate()}</button>
            })}</div></div>
            <div className="calendar-legend"><span><i className="legend-open" /> Available</span><span><i className="legend-closed" /> Closed or full</span></div>
            {availabilityLoading && <p className="booking-hint" role="status">Checking salon availability for this month...</p>}
            {bookingDate && <p className="selected-date-note"><CalendarDays size={16} /> {formatSalonDate(bookingDate)}</p>}
            {formError && <p className="booking-form-error" role="alert">{formError}</p>}
            <div className="booking-actions"><button className="button button-outline" type="button" onClick={() => advance(1)}><ArrowLeft size={15} /> Services</button><button className="button button-dark" type="button" onClick={() => bookingDate ? advance(3) : setFormError('Choose an available date to continue.')} disabled={!bookingDate || availabilityLoading || Boolean(availabilityError)}>Choose a time <ArrowRight size={15} /></button></div>
          </>}

          {step === 3 && <><div className="booking-panel-title"><span className="eyebrow">STEP 03 / {bookingDate}</span><h2>Find a time<br /><em>that works.</em></h2><p className="booking-subtitle">Available times fit your {totalDuration} minute appointment.</p></div>
            {availabilityError && <div className="booking-form-error" role="alert">Availability could not be loaded: {availabilityError} <button type="button" className="availability-retry" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}
            {!availabilityError && <><div className="booking-time-options">{timeOptions.map((slot) => <button type="button" key={slot.value} aria-pressed={startTime === slot.value} className={`booking-time-option ${startTime === slot.value ? 'selected' : ''}`} onClick={() => { setStartTime(slot.value); setFormError('') }}>{formatTime(slot.value)}</button>)}</div>{timeOptions.length === 0 && <p className="booking-hint">No available time fits all selected services. Return to the calendar and choose another date.</p>}</>}
            {formError && <p className="booking-form-error" role="alert">{formError}</p>}
            <div className="booking-actions"><button className="button button-outline" type="button" onClick={() => advance(2)}><ArrowLeft size={15} /> Calendar</button><button className="button button-dark" type="button" onClick={() => timeOptions.some((slot) => slot.value === startTime) ? advance(4) : setFormError('Choose an available time to continue.')} disabled={availabilityLoading || Boolean(availabilityError) || !timeOptions.length}>Your details <ArrowRight size={15} /></button></div>
          </>}

          {step === 4 && <><div className="booking-panel-title"><span className="eyebrow">STEP 04</span><h2>A few details,<br /><em>then we are set.</em></h2></div><form className="booking-details-form" onSubmit={validateDetails}>
            <label className="booking-label">Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} placeholder="Your name" /></label>
            <label className="booking-label">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required maxLength={254} placeholder="you@example.com" /></label>
            <label className="booking-label">Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" type="tel" pattern="[+0-9() -]{7,20}" title="Enter a valid phone number" required placeholder="+92 300 1234567" /></label>
            <label className="booking-label">Message <span className="optional-label">OPTIONAL</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows="3" maxLength="500" placeholder="Anything you would like the salon to know..." /></label>
            {formError && <p className="booking-form-error" role="alert">{formError}</p>}
            <div className="booking-actions"><button className="button button-outline" type="button" onClick={() => advance(3)}><ArrowLeft size={15} /> Time</button><button className="button button-dark" type="submit">Review booking <ArrowRight size={15} /></button></div>
          </form></>}

          {step === 5 && <><div className="booking-panel-title"><span className="eyebrow">STEP 05 / FINAL REVIEW</span><h2>Review your<br /><em>appointment.</em></h2></div>
            <div className="booking-review"><div><span>SELECTED SERVICES</span>{chosenServices.map((service) => <p className="review-service" key={service.id}><strong>{service.name}</strong><small>{service.duration} min / {formatPrice(service.price)}</small></p>)}</div><div className="booking-total"><span>TOTAL</span><strong>{formatPrice(totalPrice)}</strong><small>{totalDuration} minutes</small></div><div><span>DATE AND TIME</span><strong>{formatSalonDate(bookingDate)}</strong><small>{formatTime(startTime)} to {formatTime(endTime)}</small></div><div><span>YOUR DETAILS</span><strong>{name}</strong><small>{email.trim().toLowerCase()}</small><small>{phone}</small></div><div><span>MESSAGE</span><p>{note || 'No message added'}</p></div></div>
            {bookingError && <p className="booking-form-error" role="alert">{bookingError}</p>}<div className="booking-confirm-note">Confirming will save this booking in local storage on this browser.</div>
            <div className="booking-actions"><button className="button button-outline" type="button" onClick={() => advance(4)}><ArrowLeft size={15} /> Edit details</button><button className="button button-dark" type="button" onClick={submitBooking} disabled={submitting}>{submitting ? 'Sending booking...' : 'Confirm booking'} <ArrowRight size={15} /></button></div>
          </>}
        </div>
      </section>
      <aside className="booking-summary"><span className="eyebrow">YOUR VISIT</span><h2>A moment<br /><em>for yourself.</em></h2>{chosenServices.length ? <div className="booking-summary-services">{chosenServices.map((service) => <div key={service.id}><strong>{service.name}</strong><span>{service.duration} min / {formatPrice(service.price)}</span></div>)}<b>{totalDuration} min / {formatPrice(totalPrice)}</b></div> : <p className="booking-summary-empty">Choose one or more treatments to plan your visit.</p>}<div className="booking-summary-hours"><Clock3 size={14} /><p>Mon to Sat<br /><span>10:00 am to 7:00 pm</span></p></div></aside>
    </div>
  </main>
}
export default BookingPage
