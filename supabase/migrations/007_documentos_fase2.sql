-- ============================================================
-- SecretaríaOS — Fase 2: documentos institucionales + pgvector
-- ============================================================

-- Asegurar que pgvector esté habilitado (ya está en migration 001, pero por si acaso)
create extension if not exists vector;

-- Nuevas columnas en documentos
alter table documentos
  add column if not exists contenido  text,          -- texto extraído del PDF
  add column if not exists paginas    int,            -- número de páginas del PDF
  add column if not exists tamano_kb  int,            -- tamaño del archivo en KB
  add column if not exists procesado  boolean not null default false; -- embedding listo

-- Índice ivfflat para búsqueda semántica eficiente (requiere ≥ 100 filas para ser útil)
-- Usar cosine distance, que funciona bien con embeddings normalizados de Voyage AI
create index if not exists documentos_embedding_idx
  on documentos
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- ============================================================
-- Función RPC: búsqueda semántica por similitud coseno
-- Llamada desde el cliente con el embedding de la pregunta
-- ============================================================
create or replace function buscar_documentos_similares(
  query_embedding   vector(1536),
  match_count       int     default 3,
  umbral_similitud  float   default 0.3
)
returns table (
  id          uuid,
  nombre      text,
  tipo        text,
  descripcion text,
  contenido   text,
  archivo_url text,
  similitud   float
)
language sql stable
set search_path = public
as $$
  select
    id,
    nombre,
    tipo,
    descripcion,
    contenido,
    archivo_url,
    1 - (embedding <=> query_embedding) as similitud
  from documentos
  where
    vigente   = true
    and procesado = true
    and embedding is not null
    and (1 - (embedding <=> query_embedding)) > umbral_similitud
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Grant para que el rol anon y authenticated puedan llamar la función
grant execute on function buscar_documentos_similares(vector, int, float)
  to authenticated, anon;

-- ============================================================
-- Storage bucket: documentos-institucionales
-- (Si el bucket ya existe, el INSERT no falla por ON CONFLICT)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-institucionales',
  'documentos-institucionales',
  false,
  52428800,           -- 50 MB máximo por archivo
  array['application/pdf']
)
on conflict (id) do nothing;

-- Políticas de Storage para usuarios autenticados
do $$
begin

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'docs_upload'
  ) then
    create policy "docs_upload"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'documentos-institucionales');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'docs_read'
  ) then
    create policy "docs_read"
      on storage.objects for select
      to authenticated
      using (bucket_id = 'documentos-institucionales');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'docs_delete'
  ) then
    create policy "docs_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'documentos-institucionales');
  end if;

end $$;

-- Grants tabla documentos
grant select, insert, update, delete on documentos to authenticated, anon;
