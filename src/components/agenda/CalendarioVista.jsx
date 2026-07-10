/**
 * CalendarioVista — vista de calendario visual (FullCalendar) para Agenda.
 *
 * Muestra la disponibilidad real del Google Calendar institucional
 * (eventos en verde) combinada con eventos locales aún no sincronizados
 * (en amarillo/naranja). Solo lectura sobre los datos — crear/editar se
 * hace siempre a través del modal existente (FormEvento):
 *   - clic en un slot vacío  → abre el formulario de creación pre-llenado
 *   - clic en un evento      → abre un detalle de solo lectura
 *
 * No reemplaza la vista de lista — se integra como una alternativa en Agenda.jsx.
 */

import { useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'

/**
 * @param {{
 *   eventos: Array<object>,        — eventos ya normalizados al formato FullCalendar
 *   loading?: boolean,
 *   onRangeChange: (start: Date, end: Date) => void,
 *   onSlotClick: (date: Date) => void,
 *   onEventClick: (extendedProps: object, evento: object) => void,
 * }} props
 */
export default function CalendarioVista({ eventos, loading, onRangeChange, onSlotClick, onEventClick }) {
  const calendarRef = useRef(null)

  return (
    <div className="relative bg-white rounded-xl border border-slate-100 p-2 sm:p-3">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white shadow-sm border border-slate-100 rounded-full px-3 py-1.5">
            <span className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Cargando calendario…
          </div>
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={esLocale}
        headerToolbar={{
          left:   'prev,next today',
          center: 'title',
          right:  'dayGridMonth,timeGridWeek',
        }}
        buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana' }}
        height="auto"
        slotMinTime="06:00:00"
        slotMaxTime="21:00:00"
        slotDuration="00:30:00"
        allDaySlot={true}
        nowIndicator={true}
        selectable={true}
        selectMirror={true}
        events={eventos}
        datesSet={(info) => onRangeChange?.(info.start, info.end)}
        select={(info) => {
          onSlotClick?.(info.start)
          calendarRef.current?.getApi().unselect()
        }}
        eventClick={(info) => {
          onEventClick?.(info.event.extendedProps, info.event)
        }}
        dayMaxEvents={3}
      />
    </div>
  )
}
