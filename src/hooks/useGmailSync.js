/**
 * useGmailSync — sincronización automática de Gmail cada 15 minutos.
 *
 * Solo activa el polling si:
 *  - El usuario tiene Gmail conectado (gmail_tokens existe)
 *  - El componente está montado (se detiene al desmontar)
 *
 * Uso:
 *   const { sincronizando, ultimaSync, resultado, sincronizarAhora } = useGmailSync()
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { estadoConexionGmail } from '../lib/gmail'

const INTERVALO_MS = 15 * 60 * 1000  // 15 minutos

export function useGmailSync({ habilitado = true } = {}) {
  const { user }                          = useAuth()
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimaSync, setUltimaSync]       = useState(null)
  const [resultado, setResultado]         = useState(null)   // { procesados, creados }
  const [error, setError]                 = useState(null)
  const [gmailConectado, setGmailConectado] = useState(false)
  const intervalRef = useRef(null)
  const montado     = useRef(true)

  // Verificar si Gmail está conectado
  useEffect(() => {
    if (!user?.email) return
    estadoConexionGmail(user.email).then(e => {
      console.log('[useGmailSync] estadoConexionGmail:', e)
      if (montado.current) setGmailConectado(e.conectado)
    })
  }, [user?.email])

  const sincronizarAhora = useCallback(async () => {
    console.log('[useGmailSync] sincronizarAhora llamado', {
      email: user?.email,
      gmailConectado,
      sincronizando,
      montado: montado.current,
    })

    if (!user?.email || !gmailConectado || sincronizando) {
      console.warn('[useGmailSync] Guard bloqueó la sync:', {
        sinEmail: !user?.email,
        sinConexion: !gmailConectado,
        yaEnCurso: sincronizando,
      })
      return
    }

    setSincronizando(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      console.log('[useGmailSync] JWT obtenido:', jwt ? 'OK' : 'null')
      if (!jwt) throw new Error('No hay sesión activa')

      console.log('[useGmailSync] Llamando a /api/gmail-sync…')
      const res = await fetch('/api/gmail-sync', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ usuario_email: user.email }),
      })

      const data = await res.json()
      console.log('[useGmailSync] Respuesta /api/gmail-sync:', res.status, data)

      if (!res.ok) throw new Error(data.error ?? 'Error en sincronización')

      if (montado.current) {
        setResultado(data)
        setUltimaSync(new Date())
      }
    } catch (err) {
      console.error('[useGmailSync] Error:', err.message)
      if (montado.current) setError(err.message)
    } finally {
      if (montado.current) setSincronizando(false)
    }
  }, [user?.email, gmailConectado, sincronizando])

  // Polling automático cada 15 minutos
  useEffect(() => {
    montado.current = true

    if (!habilitado || !gmailConectado || !user?.email) return

    // Sincronizar inmediatamente al montar (con 3s de retraso para no bloquear el render inicial)
    const timer = setTimeout(() => {
      if (montado.current) sincronizarAhora()
    }, 3000)

    // Luego cada 15 minutos
    intervalRef.current = setInterval(() => {
      if (montado.current) sincronizarAhora()
    }, INTERVALO_MS)

    return () => {
      montado.current = false
      clearTimeout(timer)
      clearInterval(intervalRef.current)
    }
  }, [habilitado, gmailConectado, user?.email])

  return { sincronizando, ultimaSync, resultado, error, gmailConectado, sincronizarAhora }
}
