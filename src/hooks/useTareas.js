import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTareas() {
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchTareas()
  }, [])

  async function fetchTareas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tareas')
      .select('*, funcionario:funcionarios(id, nombre, cargo, correo, telefono, whatsapp)')
      .order('fecha_limite', { ascending: true })
    if (error) setError(error)
    else setTareas(data ?? [])
    setLoading(false)
  }

  async function crearTarea(tarea) {
    const { data, error } = await supabase
      .from('tareas')
      .insert([tarea])
      .select('*, funcionario:funcionarios(id, nombre, cargo, correo, telefono, whatsapp)')
      .single()
    if (error) throw error
    setTareas((prev) => [...prev, data])
    return data
  }

  async function actualizarTarea(id, cambios) {
    const { data, error } = await supabase
      .from('tareas')
      .update(cambios)
      .eq('id', id)
      .select('*, funcionario:funcionarios(id, nombre, cargo, correo, telefono, whatsapp)')
      .single()
    if (error) throw error
    setTareas((prev) => prev.map((t) => (t.id === id ? data : t)))
    return data
  }

  return { tareas, loading, error, crearTarea, actualizarTarea, refetch: fetchTareas }
}
