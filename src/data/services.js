import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { seededServices } from './serviceSeeds.js'

export { seededServices } from './serviceSeeds.js'

const displayOrder = new Map(seededServices.map((service, index) => [service.id, index]))

function normalizeService(service) {
  const fallback = seededServices.find((item) => item.id === service.id || item.name === service.name)
  return {
    ...service,
    description: service.description || fallback?.description || '',
    image: fallback?.image || service.image || '',
    category: fallback?.category || 'Beauty',
    duration: Number(service.duration),
    price: Number(service.price),
  }
}

export async function getServices({ includeInactive = false } = {}) {
  if (!supabase) return { services: seededServices, source: 'fallback', error: null }

  let query = supabase.from('services').select('id, name, description, price, duration, image, active, created_at, updated_at')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) return { services: seededServices, source: 'fallback', error }

  const services = (data ?? []).map(normalizeService).sort((a, b) => {
    const orderA = displayOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const orderB = displayOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB || a.name.localeCompare(b.name)
  })
  return { services, source: 'supabase', error: null }
}

export function useServices() {
  const [state, setState] = useState({ services: seededServices, source: 'fallback', loading: true, error: null })

  useEffect(() => {
    let active = true
    getServices().then((result) => {
      if (active) setState({ ...result, loading: false })
    })
    return () => { active = false }
  }, [])

  return state
}

export const formatPrice = (price) => `Rs. ${Number(price).toLocaleString('en-PK')}`
export const serviceImage = (image) => image
