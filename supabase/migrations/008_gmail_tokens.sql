-- ============================================================
-- SecretaríaOS — Fase 3: tokens OAuth de Gmail
-- ============================================================

create table if not exists gmail_tokens (
  id              uuid primary key default gen_random_uuid(),
  usuario_email   text not null unique,   -- correo del usuario Supabase autenticado
  access_token    text not null,
  refresh_token   text,                   -- null si Google no lo envía (ya había autorización previa)
  expires_at      timestamptz not null,   -- cuándo vence el access_token
  scope           text,                   -- scopes autorizados
  token_type      text default 'Bearer',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Actualizar updated_at automáticamente
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gmail_tokens_updated_at
  before update on gmail_tokens
  for each row execute function set_updated_at();

-- RLS: cada usuario solo ve y modifica sus propios tokens
alter table gmail_tokens enable row level security;

create policy "gmail_tokens_own"
  on gmail_tokens
  for all
  to authenticated
  using  (usuario_email = auth.jwt() ->> 'email')
  with check (usuario_email = auth.jwt() ->> 'email');

-- Índice por email (ya cubierto por unique, pero explícito para claridad)
create index if not exists gmail_tokens_email_idx on gmail_tokens (usuario_email);
