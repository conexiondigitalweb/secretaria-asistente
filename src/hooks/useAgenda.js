import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAgenda() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchEventos()
  }, [])

  async function fetchEventos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('eventos_agenda')
      .select('*')
      .order('fecha_inicio', { ascending: true })
    if (error) setError(error)
    else setEventos(data ?? [])
    setLoading(false)
  }

  async function crearEvento(evento) {
    const { data, error } = await supabase.from('eventos_agenda').insert([evento]).select().single()
    if (error) throw error
    setEventos((prev) => [...prev, data])
    return data
  }

  return { eventos, loading, error, crearEvento, refetch: fetchEventos }
}
