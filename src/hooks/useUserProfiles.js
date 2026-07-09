import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Administración de usuarios (solo accesible por rol admin vía RLS).
export function useUserProfiles() {
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role, display_name, active, created_at')
      .order('created_at', { ascending: true })

    if (error) setError(error)
    else { setError(null); setPerfiles(data) }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crearUsuario({ username, password, role }) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin-create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ username, password, role }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Error al crear usuario')
    await cargar()
    return body
  }

  async function actualizarRol(id, role) {
    const { error } = await supabase.from('user_profiles').update({ role }).eq('id', id)
    if (error) throw error
    await cargar()
  }

  async function toggleActivo(id, active) {
    const { error } = await supabase.from('user_profiles').update({ active }).eq('id', id)
    if (error) throw error
    await cargar()
  }

  return { perfiles, loading, error, crearUsuario, actualizarRol, toggleActivo }
}
