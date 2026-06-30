/**
 * SeccionGmail — card de conexión Gmail en la página de Configuración
 *
 * Muestra el estado de conexión y permite:
 *  - Conectar (inicia OAuth)
 *  - Probar conexión (lista últimos 10 correos)
 *  - Desconectar
 */
import { useState } from 'react'
import { Mail, CheckCircle2, XCircle, Loader2, RefreshCw, LogOut, Inbox } from 'lucide-react'
import { useGmail } from '../../hooks/useGmail'
import { cn } from '../../lib/cn'

function formatFechaCorreo(dateStr) {
  if (!dateStr) return ''
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export default function SeccionGmail({ usuarioEmail }) {
  const { estado, loading, error, correos, cargandoCorreos, conectar, desconectar, cargarCorreos } =
    useGmail(usuarioEmail)

  const [confirmDesconectar, setConfirmDesconectar] = useState(false)
  const [mostrarCorreos, setMostrarCorreos]         = useState(false)

  async function handleProbarConexion() {
    setMostrarCorreos(true)
    await cargarCorreos(10)
  }

  async function handleDesconectar() {
    setConfirmDesconectar(false)
    await desconectar()
    setMostrarCorreos(false)
  }

  return (
    <section className="bg-surface rounded-xl border border-border mt-6">

      {/* Cabecera */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <Mail className="h-4.5 w-4.5 text-red-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Gmail institucional</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Conexión con {usuarioEmail ?? 'correo institucional'}
            </p>
          </div>
        </div>

        {/* Badge estado */}
        {!loading && (
          <span className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            estado?.conectado
              ? 'bg-primary-light text-primary'
              : 'bg-surface-3 text-text-muted'
          )}>
            {estado?.conectado
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> Conectado</>
              : <><XCircle className="h-3.5 w-3.5" /> Sin conectar</>}
          </span>
        )}
        {loading && <Loader2 className="h-4 w-4 text-text-muted animate-spin" />}
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-4 space-y-4">

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Estado: desconectado */}
        {!loading && !estado?.conectado && (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Conecta tu cuenta de Gmail institucional para que SecretaríaOS pueda leer
              los correos entrantes y detectar peticiones, tutelas y solicitudes automáticamente.
              Solo se solicita permiso de <strong>lectura</strong> — nunca se enviará nada sin tu aprobación.
            </p>
            <button
              onClick={conectar}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white
                         text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              <Mail className="h-4 w-4" />
              Conectar Gmail institucional
            </button>
          </div>
        )}

        {/* Estado: conectado */}
        {!loading && estado?.conectado && (
          <div className="space-y-3">

            {/* Info token */}
            <div className="text-xs text-text-muted space-y-0.5">
              {estado.expires_at && (
                <p>Token válido hasta: <span className="text-text-secondary font-medium">
                  {new Intl.DateTimeFormat('es-CO', {
                    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                  }).format(new Date(estado.expires_at))}
                </span></p>
              )}
              {estado.scope && (
                <p>Permisos: <span className="text-text-secondary font-medium">
                  {estado.scope.includes('gmail.readonly') ? 'Lectura de correos' : estado.scope}
                </span></p>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleProbarConexion}
                disabled={cargandoCorreos}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border
                           text-sm text-text-secondary hover:bg-surface-3 transition-colors
                           disabled:opacity-50"
              >
                {cargandoCorreos
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Probar conexión
              </button>

              {!confirmDesconectar ? (
                <button
                  onClick={() => setConfirmDesconectar(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border
                             text-sm text-text-muted hover:text-destructive hover:border-red-200
                             hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">¿Confirmar?</span>
                  <button
                    onClick={handleDesconectar}
                    className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-medium
                               hover:bg-destructive-hover transition-colors"
                  >
                    Sí, desconectar
                  </button>
                  <button
                    onClick={() => setConfirmDesconectar(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted
                               hover:bg-surface-3 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista de correos de prueba */}
        {mostrarCorreos && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Inbox className="h-4 w-4 text-text-muted" />
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Últimos 10 correos recibidos
              </h3>
            </div>

            {cargandoCorreos ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-surface-3 animate-pulse" />)}
              </div>
            ) : correos.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No se encontraron correos</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {correos.map(c => (
                  <li key={c.id}
                      className={cn('px-3 py-2.5 text-xs transition-colors',
                        c.leido ? 'bg-surface' : 'bg-primary-lighter')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate', !c.leido && 'font-semibold text-text-primary')}>
                          {c.asunto}
                        </p>
                        <p className="text-text-muted truncate mt-0.5">{c.remitente}</p>
                        {c.snippet && (
                          <p className="text-text-muted truncate mt-0.5 opacity-70">{c.snippet}</p>
                        )}
                      </div>
                      <span className="text-text-muted shrink-0 whitespace-nowrap">
                        {formatFechaCorreo(c.fecha)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </div>
    </section>
  )
}
