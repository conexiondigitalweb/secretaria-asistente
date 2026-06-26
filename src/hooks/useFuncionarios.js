import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useFuncionarios({ soloActivos = false } = {}) {
  const [funcionarios, setFuncionarios] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  useEffect(() => { fetch() }, [soloActivos])

  async function fetch() {
    setLoading(true)
    let q = supabase.from('funcionarios').select('*').order('nombre')
    if (soloActivos) q = q.eq('activo', true)
    const { data, error } = await q
    if (error) setError(error)
    else setFuncionarios(data ?? [])
    setLoading(false)
  }

  async function crearFuncionario(datos) {
    const { data, error } = await supabase
      .from('funcionarios').insert([datos]).select().single()
    if (error) throw error
    setFuncionarios(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return data
  }

  async function actualizarFuncionario(id, cambios) {
    const { data, error } = await supabase
      .from('funcionarios').update(cambios).eq('id', id).select().single()
    if (error) throw error
    setFuncionarios(prev => prev.map(f => f.id === id ? data : f))
    return data
  }

  async function toggleActivo(id, activo) {
    return actualizarFuncionario(id, { activo })
  }

  return { funcionarios, loading, error, crearFuncionario, actualizarFuncionario, toggleActivo, refetch: fetch }
}
