import { useState, useEffect } from 'react'
import { useAgenda } from '../hooks/useAgenda'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import { useCalendarioEventos } from '../hooks/useCalendarioEventos'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import FormEvento from '../components/agenda/FormEvento'
import CalendarioVista from '../components/agenda/CalendarioVista'
import Modal from '../components/ui/Modal'
import { notificarDelegacion } from '../lib/notificaciones'
import { sincronizarConCalendar } from '../lib/calendarSync'

const TIPO_BADGE = {
  reunion:      'bg-primary-light text-primary border-primary/20',
  compromiso:   'bg-purple-50 text-purple-700 border-purple-200',
  recordatorio: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  evento:       'bg-green-50 text-green-700 border-green-200',
}
const TIPO_LABEL = {
  reunion: 'Reunión', compromiso: 'Compromiso', recordatorio: 'Recordatorio', evento: 'Evento',
}
const TIPO_ICON = {
  reunion: '🤝', compromiso: '📌', recordatorio: '🔔', evento: '📅',
}

function formatFechaCorta(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
function formatHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function esMismo(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function agruparPorDia(eventos) {
  const grupos = {}
  for (const e of eventos) {
    const key = new Date(e.fecha_inicio).toDateString()
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(e)
  }
  return Object.entries(grupos).map(([key, evs]) => ({ key, fecha: new Date(evs[0].fecha_inicio), evs }))
}

function EventoCard({ evento, onEditar, onEliminar }) {
  const hoy            = new Date().toDateString()
  const esHoy          = new Date(evento.fecha_inicio).toDateString() === hoy
  const esDeCalendar   = evento.origen === 'calendar'   // externo, sin versión local
  const sincronizado   = !!evento.calendar_event_id     // local que ya fue a Calendar

  return (
    <div className={`flex gap-3 p-3 rounded-xl border transition-shadow hover:shadow-sm
      ${esHoy
        ? 'border-primary/20 bg-primary-light/30'
        : esDeCalendar
          ? 'border-green-100 bg-green-50/40'
          : 'border-slate-100 bg-white'
      }`}>

      {/* Icon */}
      <div className="text-xl shrink-0 mt-0.5">
        {esDeCalendar ? '📆' : (TIPO_ICON[evento.tipo] ?? '📅')}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-slate-800 leading-snug">{evento.titulo}</span>
          <div className="flex items-center gap-1 shrink-0">
            {esDeCalendar && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium
                               bg-green-50 text-green-700 border-green-200">
                Calendar
              </span>
            )}
            {sincronizado && !esDeCalendar && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium
                               bg-green-50 text-green-600 border-green-100" title="Sincronizado con Google Calendar">
                🔄
              </span>
            )}
            {!esDeCalendar && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium
                ${TIPO_BADGE[evento.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {TIPO_LABEL[evento.tipo] ?? evento.tipo}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-0.5">
          {formatHora(evento.fecha_inicio)}
          {evento.fecha_fin && !esMismo(evento.fecha_inicio, evento.fecha_fin)
            ? ` → ${formatFechaCorta(evento.fecha_fin)} ${formatHora(evento.fecha_fin)}`
            : evento.fecha_fin
              ? ` → ${formatHora(evento.fecha_fin)}`
              : ''}
          {evento.lugar && ` · 📍 ${evento.lugar}`}
        </p>

        {evento.delegado && (
          <p className="text-xs text-slate-400 mt-0.5">
            👤 {evento.delegado.nombre} — {evento.delegado.cargo}
          </p>
        )}
        {evento.descripcion && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{evento.descripcion}</p>
        )}

        {esDeCalendar && (
          <p className="text-[10px] text-green-600 mt-1">
            Solo lectura · Editar en Google Calendar
          </p>
        )}
      </div>

      {/* Acciones — solo para eventos locales */}
      {!esDeCalendar && (
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => onEditar(evento)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-light transition-colors"
            title="Editar">✏️</button>
          <button onClick={() => onEliminar(evento)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar">🗑️</button>
        </div>
      )}
    </div>
  )
}

export default function Agenda() {
  const { user }  = useAuth()
  const { profile } = useUserProfile(user?.id)
  const { eventos: eventosLocales, loading, error, crearEvento, actualizarEvento, eliminarEvento } = useAgenda()
  const { eventos: eventosCalendar, loading: loadingCalendar, fetchEventos: fetchCalendarEventos } =
    useGoogleCalendar()
  const {
    eventos: eventosCalendarioVista, loading: loadingCalendarioVista,
    fetchRango: fetchRangoCalendario, invalidar: invalidarCalendarioVista,
  } = useCalendarioEventos()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]         = useState(null)
  const [prellenoCrear, setPrellenoCrear] = useState(null) // fecha pre-llenada desde clic en slot del calendario
  const [guardando, setGuardando]       = useState(false)
  const [errorMsg, setErrorMsg]         = useState(null)
  const [calendarSyncMsg, setCalendarSyncMsg] = useState(null) // aviso no-bloqueante de Calendar
  const [filtro, setFiltro]             = useState('proximos') // 'proximos' | 'pasados' | 'todos'
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [vista, setVista]               = useState('lista') // 'lista' | 'calendario'
  const [vistaInicializada, setVistaInicializada] = useState(false)
  const [detalleEvento, setDetalleEvento] = useState(null) // detalle solo-lectura desde clic en calendario
  // Paso 2 del modal: notificación después de guardar
  // { evento, funcionario, correoEnviado, waAbierto, enviando, error }
  const [notif, setNotif] = useState(null)

  // Cargar eventos de Calendar para el mes actual ± 2 meses
  useEffect(() => {
    if (!user?.email) return
    const inicio = new Date(); inicio.setMonth(inicio.getMonth() - 1); inicio.setDate(1)
    const fin    = new Date(); fin.setMonth(fin.getMonth() + 3); fin.setDate(1)
    fetchCalendarEventos(inicio, fin)
  }, [user?.email, fetchCalendarEventos])

  // Vista por defecto: calendario para rol 'agenda', lista para 'admin' —
  // solo se aplica una vez, al cargar el perfil, para no pisar la elección manual del usuario.
  useEffect(() => {
    if (vistaInicializada || !profile) return
    setVista(profile.role === 'agenda' ? 'calendario' : 'lista')
    setVistaInicializada(true)
  }, [profile, vistaInicializada])

  // Construir IDs de Calendar de eventos locales sincronizados (para deduplicar)
  const calendarIdsLocales = new Set(
    eventosLocales.map(e => e.calendar_event_id).filter(Boolean)
  )

  // Eventos de Calendar que NO tienen versión local (genuinamente externos)
  const eventosCalendarSoloExternos = eventosCalendar.filter(
    e => !calendarIdsLocales.has(e.calendarEventId)
  )

  // Lista unificada: locales + externos de Calendar sin duplicados
  const eventos = [
    ...eventosLocales,
    ...eventosCalendarSoloExternos,
  ].sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))

  const ahora = new Date()

  const eventosFiltrados = eventos.filter(e => {
    const inicio = new Date(e.fecha_inicio)
    if (filtro === 'proximos') return inicio >= new Date(ahora.toDateString())
    if (filtro === 'pasados')  return inicio < new Date(ahora.toDateString())
    return true
  })

  const grupos = agruparPorDia(eventosFiltrados)

  function abrirCrear(fechaPreslot) {
    setEditando(null)
    setErrorMsg(null)
    setNotif(null)
    setPrellenoCrear(fechaPreslot
      ? {
          fecha_inicio: fechaPreslot.toISOString(),
          fecha_fin:    new Date(fechaPreslot.getTime() + 60 * 60 * 1000).toISOString(),
        }
      : null)
    setModalAbierto(true)
  }
  function abrirEditar(e) {
    setEditando(e)
    setErrorMsg(null)
    setNotif(null)
    setPrellenoCrear(null)
    setModalAbierto(true)
  }
  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setPrellenoCrear(null)
    setNotif(null)
  }

  // Clic en un evento de la vista de calendario → detalle de solo lectura.
  function handleEventoCalendarioClick(extendedProps, eventoFC) {
    setDetalleEvento({
      titulo:      eventoFC.title,
      inicio:      eventoFC.start,
      fin:         eventoFC.end,
      lugar:       extendedProps.lugar,
      descripcion: extendedProps.descripcion,
      origen:      extendedProps.origen,
      eventoId:    extendedProps.eventoId,
    })
  }

  // Cambio de rango en la vista de calendario → traer eventos de ese rango.
  function handleRangoCalendarioChange(inicio, fin) {
    fetchRangoCalendario(inicio, fin)
  }

  async function handleGuardar(datos) {
    setGuardando(true)
    setErrorMsg(null)
    setCalendarSyncMsg(null)
    try {
      const guardado = editando
        ? await actualizarEvento(editando.id, datos)
        : await crearEvento(datos)

      // Sincronizar con Google Calendar solo al CREAR (no al editar, que es más complejo)
      if (!editando) {
        const { error: calErr } = await sincronizarConCalendar(guardado.id, datos)
        if (calErr) {
          // No bloqueante: mostrar aviso sutil
          setCalendarSyncMsg(calErr)
        } else {
          // Refrescar eventos de Calendar para incluir el recién creado
          const inicio = new Date(); inicio.setMonth(inicio.getMonth() - 1); inicio.setDate(1)
          const fin    = new Date(); fin.setMonth(fin.getMonth() + 3); fin.setDate(1)
          fetchCalendarEventos(inicio, fin)
        }
      }

      // Invalidar el cache de la vista de calendario para que refleje el
      // evento recién creado/editado la próxima vez que se consulte el rango.
      invalidarCalendarioVista()

      // Si el evento guardado tiene delegado con datos de contacto → paso 2: notificación
      const delegado = guardado?.delegado
      if (delegado && (delegado.correo || delegado.whatsapp)) {
        setNotif({ evento: guardado, funcionario: delegado,
                   correoEnviado: false, waAbierto: false, enviando: false, error: null })
        // El modal permanece abierto mostrando el panel de notificación
      } else {
        cerrarModal()
      }
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleNotificarCorreo() {
    if (!notif?.funcionario?.correo) return
    setNotif(s => ({ ...s, enviando: true, error: null }))
    const { correo } = await notificarDelegacion(notif.funcionario, notif.evento)
    setNotif(s => ({
      ...s,
      enviando:      false,
      correoEnviado: correo.ok,
      error:         correo.ok ? null : correo.error,
    }))
  }

  function handleNotificarWA() {
    if (!notif) return
    const { funcionario, evento } = notif
    const tel = funcionario.whatsapp?.replace(/[\s\-().+]/g, '')
    if (!tel) return
    const num = tel.startsWith('57') ? tel : '57' + tel
    const fecha = evento.fecha_inicio
      ? new Date(evento.fecha_inicio).toLocaleDateString('es-CO', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }) + ' ' + new Date(evento.fecha_inicio).toLocaleTimeString('es-CO', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
      : ''
    const msg =
      `Hola ${funcionario.nombre}, quedas delegado en el siguiente evento:\n\n` +
      `*Evento:* ${evento.titulo}\n` +
      (fecha ? `*Fecha:* ${fecha}\n` : '') +
      (evento.lugar ? `*Lugar:* ${evento.lugar}\n` : '') +
      (evento.descripcion ? `\n${evento.descripcion}` : '')
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
    setNotif(s => ({ ...s, waAbierto: true }))
  }

  async function handleEliminar() {
    if (!confirmarEliminar) return
    try {
      await eliminarEvento(confirmarEliminar.id)
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setConfirmarEliminar(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Agenda</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {loading ? '…' : `${eventosLocales.length} local${eventosLocales.length !== 1 ? 'es' : ''}${eventosCalendarSoloExternos.length > 0 ? ` · ${eventosCalendarSoloExternos.length} de Calendar` : ''}`}
          </p>
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white
                     text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <span className="text-base leading-none">+</span>
          <span className="hidden sm:inline">Nuevo evento</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* Toggle Lista / Calendario */}
      <div className="flex gap-1 mb-3">
        {[
          { value: 'lista',      label: '📋 Lista' },
          { value: 'calendario', label: '🗓️ Calendario' },
        ].map(({ value, label }) => (
          <button key={value} onClick={() => setVista(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              vista === value
                ? 'bg-primary text-white border-primary'
                : 'text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtros — solo aplican a la vista de lista */}
      {vista === 'lista' && (
        <div className="flex gap-1 mb-4">
          {[
            { value: 'proximos', label: 'Próximos' },
            { value: 'pasados',  label: 'Pasados' },
            { value: 'todos',    label: 'Todos' },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => setFiltro(value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filtro === value ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Error global */}
      {(error || errorMsg) && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error?.message ?? errorMsg}
        </div>
      )}

      {/* Aviso no-bloqueante: sincronización Calendar falló al crear */}
      {calendarSyncMsg && (
        <div className="mb-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="shrink-0">⚠️</span>
          <span>
            Evento guardado localmente, pero no se pudo sincronizar con Google Calendar: {calendarSyncMsg}
          </span>
          <button onClick={() => setCalendarSyncMsg(null)} className="ml-auto text-amber-500 hover:text-amber-700 shrink-0">✕</button>
        </div>
      )}

      {/* Contenido */}
      {vista === 'calendario' ? (
        <>
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600 inline-block" /> Sincronizado con Calendar</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Local, pendiente de sincronizar</span>
          </p>
          <CalendarioVista
            eventos={eventosCalendarioVista}
            loading={loadingCalendarioVista}
            onRangeChange={handleRangoCalendarioChange}
            onSlotClick={abrirCrear}
            onEventClick={handleEventoCalendarioClick}
          />
        </>
      ) : loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-5xl mb-3">📅</p>
          <p className="text-sm font-medium text-slate-500">No hay eventos {filtro === 'proximos' ? 'próximos' : filtro === 'pasados' ? 'pasados' : ''}</p>
          <p className="text-xs mt-1">Crea el primer evento con el botón "Nuevo"</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(({ key, fecha, evs }) => {
            const esHoy = fecha.toDateString() === ahora.toDateString()
            const esMañana = fecha.toDateString() === new Date(ahora.getTime() + 86400000).toDateString()
            const labelDia = esHoy ? 'Hoy' : esMañana ? 'Mañana'
              : fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

            return (
              <div key={key}>
                <div className={`flex items-center gap-2 mb-2 ${esHoy ? 'text-primary' : 'text-slate-500'}`}>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${esHoy ? 'text-primary' : ''}`}>
                    {labelDia}
                  </span>
                  {esHoy && (
                    <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full font-medium">HOY</span>
                  )}
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{evs.length} evento{evs.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-2">
                  {evs.map(e => (
                    <EventoCard key={e.id} evento={e}
                      onEditar={abrirEditar}
                      onEliminar={setConfirmarEliminar} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar → paso 2: notificación */}
      <Modal
        open={modalAbierto}
        onClose={cerrarModal}
        title={
          notif
            ? `✓ Guardado — notificar a ${notif.funcionario.nombre}`
            : editando
              ? `Editar — ${editando.titulo}`
              : 'Nuevo evento'
        }
      >
        {/* ── Paso 1: formulario ── */}
        {!notif && (
          <>
            {errorMsg && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMsg}
              </div>
            )}
            <FormEvento
              inicial={editando ?? prellenoCrear}
              fechaVacia={false}
              onSubmit={handleGuardar}
              onCancel={cerrarModal}
              loading={guardando}
            />
          </>
        )}

        {/* ── Paso 2: notificación al delegado ── */}
        {notif && (
          <div className="flex flex-col gap-4">
            {/* Resumen del evento guardado */}
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-xs font-semibold text-green-700 mb-1">Evento guardado correctamente</p>
              <p className="text-sm font-medium text-slate-800">{notif.evento.titulo}</p>
              {notif.evento.fecha_inicio && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(notif.evento.fecha_inicio).toLocaleDateString('es-CO', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {' — '}
                  {new Date(notif.evento.fecha_inicio).toLocaleTimeString('es-CO', {
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                  {notif.evento.lugar && ` · 📍 ${notif.evento.lugar}`}
                </p>
              )}
            </div>

            {/* Delegado */}
            <div className="flex items-center gap-3 px-1">
              <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center
                              justify-center text-sm font-bold shrink-0">
                {notif.funcionario.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{notif.funcionario.nombre}</p>
                <p className="text-xs text-slate-500">{notif.funcionario.cargo}</p>
              </div>
            </div>

            {/* Botones de notificación */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
              <p className="text-xs font-medium text-slate-600 mb-1">
                ¿Notificar a <span className="text-slate-800">{notif.funcionario.nombre}</span> sobre este evento?
              </p>

              <div className="flex gap-2">
                {/* Correo */}
                <button
                  type="button"
                  disabled={!notif.funcionario.correo || notif.enviando}
                  onClick={handleNotificarCorreo}
                  title={notif.funcionario.correo ?? 'Sin correo registrado'}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                    text-xs font-medium border transition-colors
                    ${notif.correoEnviado
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : notif.funcionario.correo
                        ? 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700'
                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    }`}
                >
                  {notif.enviando ? '⏳' : notif.correoEnviado ? '✓' : '✉️'}
                  <span>{notif.correoEnviado ? 'Correo enviado' : 'Notificar por correo'}</span>
                </button>

                {/* WhatsApp */}
                <button
                  type="button"
                  disabled={!notif.funcionario.whatsapp}
                  onClick={handleNotificarWA}
                  title={notif.funcionario.whatsapp ?? 'Sin WhatsApp registrado'}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                    text-xs font-medium border transition-colors
                    ${notif.waAbierto
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : notif.funcionario.whatsapp
                        ? 'bg-white text-slate-700 border-slate-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700'
                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    }`}
                >
                  {notif.waAbierto ? '✓' : '💬'}
                  <span>{notif.waAbierto ? 'WhatsApp abierto' : 'Abrir WhatsApp'}</span>
                </button>
              </div>

              {/* Aviso si no tiene ningún canal */}
              {!notif.funcionario.correo && !notif.funcionario.whatsapp && (
                <p className="text-xs text-slate-400">
                  {notif.funcionario.nombre} no tiene correo ni WhatsApp registrado.
                  Agrégalos en Configuración.
                </p>
              )}

              {/* Error de correo */}
              {notif.error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {notif.error}
                </p>
              )}
            </div>

            {/* Cerrar */}
            <button
              type="button"
              onClick={cerrarModal}
              className="w-full py-2 rounded-lg border border-slate-200 text-sm text-slate-600
                         hover:bg-slate-50 transition-colors"
            >
              {notif.correoEnviado || notif.waAbierto ? 'Listo' : 'Cerrar sin notificar'}
            </button>
          </div>
        )}
      </Modal>

      {/* Detalle de solo lectura — clic en un evento de la vista de calendario */}
      <Modal
        open={!!detalleEvento}
        onClose={() => setDetalleEvento(null)}
        title={detalleEvento?.titulo ?? 'Evento'}
      >
        {detalleEvento && (
          <div className="flex flex-col gap-3">
            <div className={`inline-flex self-start items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border font-medium
              ${detalleEvento.origen === 'calendar'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {detalleEvento.origen === 'calendar' ? '📆 Google Calendar' : '⏳ Local · pendiente de sincronizar'}
            </div>

            <p className="text-sm text-slate-700">
              {detalleEvento.inicio && new Date(detalleEvento.inicio).toLocaleString('es-CO', {
                weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: true,
              })}
              {detalleEvento.fin && (
                ` → ${new Date(detalleEvento.fin).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}`
              )}
            </p>

            {detalleEvento.lugar && (
              <p className="text-xs text-slate-500">📍 {detalleEvento.lugar}</p>
            )}
            {detalleEvento.descripcion && (
              <p className="text-xs text-slate-500 whitespace-pre-wrap">{detalleEvento.descripcion}</p>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              {detalleEvento.origen === 'local' && (
                <button
                  onClick={() => {
                    const local = eventosLocales.find(e => e.id === detalleEvento.eventoId)
                    setDetalleEvento(null)
                    if (local) abrirEditar(local)
                  }}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ✏️ Editar
                </button>
              )}
              <button onClick={() => setDetalleEvento(null)}
                className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal
        open={!!confirmarEliminar}
        onClose={() => setConfirmarEliminar(null)}
        title="Eliminar evento"
      >
        <p className="text-sm text-slate-700 mb-1">
          ¿Eliminar <strong>{confirmarEliminar?.titulo}</strong>?
        </p>
        <p className="text-xs text-slate-400 mb-5">Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmarEliminar(null)}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleEliminar}
            className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
            Eliminar
          </button>
        </div>
      </Modal>

    </div>
  )
}
