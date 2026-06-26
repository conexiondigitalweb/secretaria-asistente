# CLAUDE.md — SecretaríaOS
## Asistente de gestión para la Secretaría de Educación, Cultura y Turismo de Ocaña, Norte de Santander, Colombia

---

## Identidad del proyecto

**Nombre:** SecretaríaOS  
**Repositorio:** conexiondigitalweb/secretaria-asistente  
**Dominio objetivo:** secretaria.ocana.gov.co (o subdominio a definir)  
**Deploy:** Vercel (cuenta conexiondigitalweb)  
**Estado actual:** Fase 1 — dashboard + gestión manual de tareas

---

## Contexto institucional

- **Entidad:** Secretaría de Educación, Cultura y Turismo — Municipio de Ocaña, Norte de Santander, Colombia
- **Secretario:** Doiler Alfonso Sanjuán Sánchez
- **Asistente:** (por definir, acceso nivel asistente)
- **Correo hub Gmail:** (configurar: secretaria.ocana.hub@gmail.com o similar)
- **Correo institucional:** @ocana-nortedesantander.gov.co (Gobierno Digital Colombia / Google Workspace MinTIC)

---

## Stack técnico

```
Frontend:   React 18 + Vite + Tailwind CSS
Backend:    Supabase (PostgreSQL + Auth + pgvector + Storage)
IA:         Anthropic API — modelo claude-sonnet-4-6
Email:      Gmail API (OAuth 2.0) + Resend (notificaciones salientes)
Deploy:     Vercel
Control:    GitHub (conexiondigitalweb)
```

---

## Estructura de carpetas

```
secretaria-asistente/
├── CLAUDE.md                  # Este archivo
├── .env.local                 # Variables de entorno (nunca al repo)
├── .gitignore
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json
├── public/
│   └── manifest.json          # PWA manifest
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   │   ├── dashboard/         # Vista principal diaria
│   │   ├── tareas/            # Gestión de tareas y solicitudes
│   │   ├── agenda/            # Calendario y reuniones
│   │   ├── documentos/        # Carga y consulta de documentos institucionales
│   │   ├── correo/            # Bandeja Gmail integrada (Fase 3)
│   │   └── ui/                # Componentes reutilizables (botones, cards, badges)
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Tareas.jsx
│   │   ├── Agenda.jsx
│   │   ├── Documentos.jsx
│   │   └── Configuracion.jsx
│   ├── lib/
│   │   ├── supabase.js        # Cliente Supabase
│   │   ├── anthropic.js       # Llamadas a la API de Claude
│   │   ├── gmail.js           # Gmail API integration (Fase 3)
│   │   └── utils.js           # Helpers generales
│   └── hooks/
│       ├── useTareas.js
│       ├── useAgenda.js
│       └── useAuth.js
└── supabase/
    └── migrations/            # SQL de esquema de base de datos
```

---

## Variables de entorno (.env.local)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ANTHROPIC_API_KEY=
VITE_GMAIL_CLIENT_ID=
VITE_GMAIL_CLIENT_SECRET=
VITE_RESEND_API_KEY=
```

> ⚠️ Nunca commitear este archivo. Está en .gitignore.

---

## Base de datos Supabase — esquema principal

### Tabla: `tareas`
Gestiona todas las solicitudes, peticiones, tutelas y tareas del despacho.

```sql
id              uuid PRIMARY KEY
tipo            text  -- 'tutela' | 'peticion' | 'queja' | 'solicitud' | 'reunion' | 'tarea' | 'otro'
origen          text  -- 'correo' | 'fisico' | 'verbal' | 'whatsapp' | 'otro'
asunto          text
descripcion     text
remitente       text
fecha_recibido  timestamptz
fecha_limite    timestamptz  -- calculada según tipo (tutela=10d, peticion=15d, etc.)
estado          text  -- 'pendiente' | 'en_proceso' | 'resuelto' | 'vencido'
prioridad       text  -- 'critica' | 'alta' | 'media' | 'baja'
asignado_a      uuid  -- FK a users
borrador_ia     text  -- borrador generado por Claude
respuesta_final text
correo_id       text  -- ID del correo Gmail si aplica
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### Tabla: `eventos_agenda`
```sql
id              uuid PRIMARY KEY
titulo          text
descripcion     text
fecha_inicio    timestamptz
fecha_fin       timestamptz
tipo            text  -- 'reunion' | 'compromiso' | 'recordatorio' | 'evento'
lugar           text
participantes   text[]
tarea_id        uuid  -- FK a tareas (opcional)
created_by      uuid
created_at      timestamptz DEFAULT now()
```

### Tabla: `documentos`
```sql
id              uuid PRIMARY KEY
nombre          text
tipo            text  -- 'plan_desarrollo' | 'plan_accion' | 'normativa' | 'informe' | 'otro'
descripcion     text
archivo_url     text  -- Supabase Storage
embedding       vector(1536)  -- para búsqueda semántica con pgvector
vigente         boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### Tabla: `notificaciones`
```sql
id              uuid PRIMARY KEY
tarea_id        uuid
tipo            text  -- 'vencimiento_3d' | 'vencimiento_1d' | 'vencimiento_hoy' | 'nueva_tarea'
enviada         boolean DEFAULT false
fecha_envio     timestamptz
created_at      timestamptz DEFAULT now()
```

---

## Roles de usuario

| Rol | Permisos |
|---|---|
| `secretario` | Acceso total. Aprueba borradores, envía respuestas, configura el sistema |
| `asistente` | Crea tareas, ingresa correos manuales, actualiza estados. No puede enviar respuestas ni acceder a configuración |

---

## Lógica de fechas límite por tipo de solicitud (Colombia)

```javascript
const DIAS_LIMITE = {
  tutela:   10,   // Decreto 2591/1991 — improrrogable
  peticion: 15,   // Ley 1755/2015 — derecho de petición
  queja:    15,
  solicitud: 15,
  reunion:  null, // fecha manual
  tarea:    null, // fecha manual
}
```

---

## Fases de implementación

| Fase | Contenido | Estado |
|---|---|---|
| Preparación | Git, repo, carpeta, Gmail hub | ✅ Completo |
| Fase 1 | Dashboard + ingreso manual de tareas + agenda | 🔄 En curso |
| Fase 2 | Carga de documentos institucionales + Claude con contexto + borradores IA | ⏳ Pendiente |
| Fase 3 | Gmail API conectado — lectura automática de correos | ⏳ Pendiente |
| Fase 4 | Alertas automáticas + digest diario + reporte semanal | ⏳ Pendiente |

---

## Convenciones de código

- Componentes en PascalCase: `TareasCard.jsx`
- Hooks en camelCase con prefijo use: `useTareas.js`
- Funciones de utilidad en camelCase: `calcularFechaLimite()`
- Español para nombres de dominio (tareas, eventos, documentos)
- Inglés para términos técnicos (hooks, utils, handlers)
- Tailwind para todos los estilos — sin CSS modules ni styled-components
- No usar `any` implícito — props tipadas con PropTypes o JSDoc cuando aplique

---

## Comandos frecuentes

```bash
npm run dev        # Desarrollo local
npm run build      # Build de producción
npm run preview    # Preview del build
git add . && git commit -m "mensaje" && git push origin master
```

---

## Notas críticas

1. **Nunca enviar correos automáticamente.** Toda respuesta pasa por aprobación explícita del secretario.
2. **Fechas límite de tutelas son improrrogables.** Alertar con máxima prioridad desde el día de recibido.
3. **El sistema es de uso interno.** No hay registro público ni formularios externos.
4. **Los documentos institucionales** (Plan de Desarrollo, etc.) se suben desde el dashboard — no van en el repositorio.
5. **Supabase org:** Digiconexo — mismo que Reposta y Marcagol.
6. **API key Anthropic:** la misma que ya existe en los otros proyectos.

---

*Última actualización: Fase 1 iniciada*
