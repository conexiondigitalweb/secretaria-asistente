# CLAUDE.md — SecretaríaOS
## Asistente de gestión para la Secretaría de Educación, Cultura y Turismo de Ocaña, Norte de Santander, Colombia

---

## Identidad del proyecto

**Nombre:** SecretaríaOS  
**Repositorio:** conexiondigitalweb/secretaria-asistente  
**Dominio objetivo:** secretaria.ocana.gov.co (o subdominio a definir)  
**Deploy:** Vercel (cuenta conexiondigitalweb)  
**Estado actual:** Fase 3 — Gmail sync en depuración

---

## Contexto institucional

- **Entidad:** Secretaría de Educación, Cultura y Turismo — Municipio de Ocaña, Norte de Santander, Colombia
- **Secretario:** Doiler Alfonso Sanjuán Sánchez
- **Asistente:** (por definir, acceso nivel asistente)
- **Correo hub Gmail:** sectocana@gmail.com
- **Correo institucional:** @ocana-nortedesantander.gov.co (Gobierno Digital Colombia / Google Workspace MinTIC)

---

## Stack técnico

```
Frontend:   React 19 + Vite 8 + Tailwind CSS v4 (sintaxis @theme en index.css, sin tailwind.config.js)
Backend:    Supabase (PostgreSQL + Auth + pgvector + Storage)
IA:         Anthropic API — modelo claude-sonnet-4-5
Embeddings: Voyage AI — voyage-large-2 (1536 dims)
Email:      Gmail API (OAuth 2.0) + Resend (notificaciones salientes)
Deploy:     Vercel (vercel dev en localhost:3001 para desarrollo local)
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
├── vite.config.js             # Tailwind v4 plugin incluido aquí
├── package.json
├── public/
│   └── manifest.json          # PWA manifest
├── api/                       # Vercel Serverless Functions
│   ├── gmail-token-exchange.js  # Intercambio code → tokens OAuth
│   ├── gmail-refresh-token.js   # Renovación de access_token
│   ├── gmail-sync.js            # Clasificación automática de correos con Claude
│   ├── generate-embedding.js    # Genera embeddings Voyage AI para documentos
│   ├── chat-document.js         # RAG con Claude sobre documentos
│   └── send-email.js            # Proxy Resend (evita CORS desde cliente)
├── src/
│   ├── main.jsx
│   ├── App.jsx                  # Intercepta /oauth/callback antes del layout principal
│   ├── index.css                # Tailwind v4: variables en @theme {}
│   ├── components/
│   │   ├── dashboard/           # StatCard, TareaUrgente, EventoHoy
│   │   ├── tareas/              # TablaTareas (badge "📧 Desde correo" para origen=correo)
│   │   ├── agenda/              # Calendario y reuniones
│   │   ├── documentos/          # FormDocumento, ListaDocumentos, ChatConsulta
│   │   ├── configuracion/       # SeccionGmail (conectar/desconectar OAuth)
│   │   └── ui/                  # Componentes reutilizables
│   ├── pages/
│   │   ├── Dashboard.jsx        # KPIs + urgentes + agenda hoy + indicador Gmail sync
│   │   ├── Tareas.jsx
│   │   ├── Agenda.jsx
│   │   ├── Documentos.jsx       # Upload PDF + RAG chat
│   │   ├── Configuracion.jsx    # Sección Gmail OAuth
│   │   └── OAuthCallback.jsx    # Maneja redirect de Google (/oauth/callback)
│   ├── lib/
│   │   ├── supabase.js          # Cliente Supabase (anon key)
│   │   ├── anthropic.js         # Llamadas a la API de Claude
│   │   ├── gmail.js             # OAuth flow, token management, Gmail API helpers
│   │   └── utils.js             # calcularFechaLimite, diasHabilesRestantes, etc.
│   └── hooks/
│       ├── useTareas.js
│       ├── useAgenda.js
│       ├── useAuth.js
│       ├── useGmail.js          # Estado de conexión Gmail
│       ├── useGmailSync.js      # Polling automático cada 15 min → /api/gmail-sync
│       └── useDocumentos.js     # CRUD documentos + búsqueda semántica
└── supabase/
    └── migrations/              # SQL de esquema — ejecutar en orden en Supabase SQL Editor
        ├── 001_...sql
        ├── ...
        ├── 008_gmail_tokens.sql
        ├── 009_gmail_tokens_fix_rls.sql
        ├── 010_gmail_sync.sql
        └── 011_gmail_tokens_service_role_grant.sql
```

---

## Variables de entorno (.env.local)

> ⚠️ Nunca commitear este archivo. Está en .gitignore.

Las variables **sin prefijo `VITE_`** solo están disponibles en funciones serverless (`api/`).  
Las variables **con prefijo `VITE_`** se inyectan en el bundle de Vite y son visibles en el cliente.

```env
# Supabase — cliente (público)
VITE_SUPABASE_URL=https://lnhpuzrjdroumadkmots.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

# Supabase — servidor (sin prefijo VITE_, solo en api/)
SUPABASE_URL=https://lnhpuzrjdroumadkmots.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # NUNCA al cliente

# Gmail OAuth — Client ID es público por diseño
VITE_GMAIL_CLIENT_ID=118488598307-...
GMAIL_CLIENT_ID=118488598307-...         # también en api/
GMAIL_CLIENT_SECRET=GOCSPX-...          # SOLO en api/, nunca con prefijo VITE_

# Anthropic
VITE_ANTHROPIC_API_KEY=sk-ant-...       # cliente (dev solamente)
ANTHROPIC_API_KEY=sk-ant-...            # api/ serverless

# Voyage AI (embeddings) — solo servidor
VOYAGE_API_KEY=pa-...

# Resend (email saliente) — solo servidor
RESEND_API_KEY=re_...
```

### Variables en Vercel por entorno

Todas las vars sin prefijo `VITE_` deben estar en **Development, Preview y Production**.  
`vercel dev` usa el entorno **Development** — si una var falta allí, la función serverless la leerá como `undefined`.

| Variable | Development | Preview | Production |
|---|:---:|:---:|:---:|
| `SUPABASE_URL` | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ |
| `ANTHROPIC_API_KEY` | ✅ | ✅ | ✅ |
| `VITE_ANTHROPIC_API_KEY` | ✅ | ✅ | ✅ |
| `VOYAGE_API_KEY` | ✅ | ✅ | ✅ |
| `GMAIL_CLIENT_ID` | ✅ | ✅ | ✅ |
| `GMAIL_CLIENT_SECRET` | ✅ | ✅ | ✅ |
| `RESEND_API_KEY` | ✅ | ✅ | ✅ |

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

### Tabla: `gmail_tokens`
```sql
id              uuid PRIMARY KEY
usuario_email   text NOT NULL UNIQUE
access_token    text NOT NULL
refresh_token   text
expires_at      timestamptz
scope           text
token_type      text DEFAULT 'Bearer'
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```
RLS habilitado — políticas separadas por operación (select/insert/update/delete) para `authenticated`.  
⚠️ **GRANT también requerido para `service_role`** (migration 011) — BYPASSRLS y GRANT son capas independientes en PostgreSQL.

### Tabla: `gmail_sync`
```sql
id                uuid PRIMARY KEY
usuario_email     text NOT NULL UNIQUE
history_id        text           -- último historyId procesado de Gmail
last_sync_at      timestamptz
emails_procesados int DEFAULT 0
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```
⚠️ También requiere GRANT a `service_role` (migration 011).

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
| Fase 1 | Dashboard + ingreso manual de tareas + agenda | ✅ Completo |
| Fase 2 | Carga de documentos institucionales + Claude RAG + embeddings Voyage AI | ✅ Completo |
| Fase 3 | Gmail OAuth + lectura automática + clasificación Claude cada 15 min | 🔄 En depuración |
| Fase 4 | Alertas automáticas + digest diario + reporte semanal | ⏳ Pendiente |

### Fase 3 — Detalle de estado

- ✅ OAuth flow completo (Google → `/oauth/callback` → token exchange → `gmail_tokens`)
- ✅ Token guardado en `gmail_tokens` para `sectocana@gmail.com`
- ✅ `api/gmail-sync.js` construido (History API incremental, clasificación Claude, crea tareas/eventos)
- ✅ `useGmailSync` hook con polling cada 15 min + sync manual desde Dashboard
- ✅ Todas las variables de entorno confirmadas en Vercel Development
- ✅ `vercel dev` en `localhost:3001`; Google Cloud Console tiene URIs para `:3000`, `:3001` y `secretaria-asistente.vercel.app`
- 🔄 **Bug pendiente:** `"Gmail no conectado para este usuario"` — causa raíz identificada:
  - `gmail-sync.js` usa cliente Supabase con `service_role` key
  - La tabla `gmail_tokens` solo tenía `GRANT` a `authenticated`, no a `service_role`
  - La consulta falla silenciosamente → `tokenRow` es `null` → error falso "no conectado"
  - **Fix:** migración `011_gmail_tokens_service_role_grant.sql` — pendiente ejecutar en Supabase SQL Editor
- ⚠️ Token OAuth expira cada hora (app en modo **Testing** de Google Cloud Console) — requiere reconexión manual o publicar la app en producción

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
vercel dev                    # Desarrollo local con serverless functions (puerto 3001)
npm run build                 # Build de producción
npm run preview               # Preview del build
vercel env ls                 # Ver variables de entorno por entorno
vercel env pull               # Sincronizar vars de Vercel → .env.local (cuidado: sobreescribe)
git add . && git commit -m "mensaje" && git push origin master
```

### Patrón crítico — variables de entorno en serverless

```js
// ❌ MAL — captura undefined si el módulo se cargó antes del env
const API_KEY = process.env.ANTHROPIC_API_KEY

// ✅ BIEN — leer siempre dentro del handler
export default async function handler(req, res) {
  const API_KEY = process.env.ANTHROPIC_API_KEY
  ...
}
```

### Patrón crítico — serverless no puede llamarse a sí mismo

```js
// ❌ MAL — no funciona en contexto serverless (no hay servidor HTTP local)
const res = await fetch('/api/gmail-refresh-token', { ... })

// ✅ BIEN — extraer la lógica como función e importarla o duplicarla
async function refreshAccessToken(refreshToken) {
  return fetch('https://oauth2.googleapis.com/token', { ... })
}
```

---

## Notas críticas

1. **Nunca enviar correos automáticamente.** Toda respuesta pasa por aprobación explícita del secretario.
2. **Fechas límite de tutelas son improrrogables.** Alertar con máxima prioridad desde el día de recibido (Decreto 2591/1991).
3. **El sistema es de uso interno.** No hay registro público ni formularios externos.
4. **Los documentos institucionales** (Plan de Desarrollo, etc.) se suben desde el dashboard — no van en el repositorio.
5. **Supabase org:** Digiconexo — mismo que Reposta y Marcagol.
6. **API key Anthropic:** la misma que ya existe en los otros proyectos.
7. **RLS + GRANT son capas independientes en PostgreSQL.** Habilitar RLS no implica que `service_role` pueda acceder — siempre hacer `GRANT ... TO service_role` además de `TO authenticated`.
8. **`vercel dev` usa entorno Development de Vercel**, no todas las vars de `.env.local`. Cualquier var nueva para serverless debe agregarse con `vercel env add <VAR> development`.
9. **Token Gmail expira cada hora en modo Testing.** Para producción, publicar la app en Google Cloud Console (verificación de dominio requerida para scopes sensibles como `gmail.readonly`).
10. **Tailwind CSS v4** — no hay `tailwind.config.js`. Los colores y tokens se definen en `src/index.css` dentro del bloque `@theme {}`. El plugin se carga desde `vite.config.js`.

---

*Última actualización: 2026-07-01 — Fase 3 en depuración*
