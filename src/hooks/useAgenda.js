import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAgenda() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => { fetchEventos() }, [])

  async function fetchEventos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('eventos_agenda')
      // Incluir datos del delegado en la misma query
      .select('*, delegado:funcionarios(id, nombre, cargo)')
      .order('fecha_inicio', { ascending: true })
    if (error) setError(error)
    else setEventos(data ?? [])
    setLoading(false)
  }

  async function crearEvento(evento) {
    const { data, error } = await supabase
      .from('eventos_agenda')
      .insert([evento])
      .select('*, delegado:funcionarios(id, nombre, cargo)')
      .single()
    if (error) throw error
    setEventos(prev => [...prev, data].sort((a, b) =>
      new Date(a.fecha_inicio) - new Date(b.fecha_inicio)))
    return data
  }

  async function actualizarEvento(id, cambios) {
    const { data, error } = await supabase
      .from('eventos_agenda')
      .update(cambios)
      .eq('id', id)
      .select('*, delegado:funcionarios(id, nombre, cargo)')
      .single()
    if (error) throw error
    setEventos(prev => prev.map(e => e.id === id ? data : e))
    return data
  }

  async function eliminarEvento(id) {
    const { error } = await supabase.from('eventos_agenda').delete().eq('id', id)
    if (error) throw error
    setEventos(prev => prev.filter(e => e.id !== id))
  }

  return { eventos, loading, error, crearEvento, actualizarEvento, eliminarEvento, refetch: fetchEventos }
}
