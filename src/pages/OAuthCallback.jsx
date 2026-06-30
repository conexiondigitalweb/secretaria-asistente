/**
 * OAuthCallback — /oauth/callback
 *
 * Google redirige aquí con ?code=...&scope=...
 * Esta página:
 *  1. Extrae el código de la URL
 *  2. Llama a /api/gmail-token-exchange para obtener los tokens
 *  3. Guarda los tokens en Supabase (tabla gmail_tokens)
 *  4. Redirige a /configuracion con estado de éxito/error
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { intercambiarCodigo, guardarTokens } from '../lib/gmail'
import { useAuth } from '../hooks/useAuth'

export default function OAuthCallback({ onNavegar }) {
  const { user } = useAuth()
  const [estado, setEstado] = useState('procesando')  // procesando | ok | error
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function procesarCallback() {
      const params = new URLSearchParams(window.location.search)
      const code  = params.get('code')
      const error = params.get('error')

      if (error) {
        setMensaje(error === 'access_denied'
          ? 'Autorización cancelada. Puedes intentarlo de nuevo cuando quieras.'
          : `Error de Google: ${error}`)
        setEstado('error')
        return
      }

      if (!code) {
        setMensaje('No se recibió código de autorización.')
        setEstado('error')
        return
      }

      if (!user?.email) {
        setMensaje('No hay sesión activa. Inicia sesión primero.')
        setEstado('error')
        return
      }

      try {
        const tokens = await intercambiarCodigo(code)
        await guardarTokens(tokens, user.email)
        setEstado('ok')
        setMensaje('Gmail conectado correctamente.')

        // Redirigir a Configuración tras 2 s
        setTimeout(() => {
          // Limpiar el código de la URL antes de navegar
          window.history.replaceState({}, '', '/')
          onNavegar?.('configuracion')
        }, 2000)

      } catch (err) {
        setMensaje(err.message)
        setEstado('error')
      }
    }

    procesarCallback()
  }, [user])

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-8 max-w-sm w-full text-center">

        <img src="/logo-secretaria.jpg" alt="Logo" className="h-14 w-14 object-contain mx-auto mb-5 opacity-80" />

        {estado === 'procesando' && (
          <>
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-text-primary">Conectando Gmail…</p>
            <p className="text-xs text-text-muted mt-1">Intercambiando credenciales con Google</p>
          </>
        )}

        {estado === 'ok' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-sm font-semibold text-text-primary">¡Gmail conectado!</p>
            <p className="text-xs text-text-muted mt-1">{mensaje}</p>
            <p className="text-xs text-text-muted mt-3">Redirigiendo a Configuración…</p>
          </>
        )}

        {estado === 'error' && (
          <>
            <XCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
            <p className="text-sm font-semibold text-text-primary">Error de conexión</p>
            <p className="text-xs text-text-muted mt-1">{mensaje}</p>
            <button
              onClick={() => onNavegar?.('configuracion')}
              className="mt-5 w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium
                         hover:bg-primary-hover transition-colors"
            >
              Volver a Configuración
            </button>
          </>
        )}

      </div>
    </div>
  )
}
