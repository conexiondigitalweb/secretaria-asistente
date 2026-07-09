import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Perfil (rol) del usuario autenticado actual.
export function useUserProfile(userId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelado = false
    setLoading(true)

    supabase
      .from('user_profiles')
      .select('id, role, display_name, active')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        setProfile(error ? null : data)
        setLoading(false)
      })

    return () => { cancelado = true }
  }, [userId])

  return { profile, loading }
}
