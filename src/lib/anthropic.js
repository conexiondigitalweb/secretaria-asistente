// Llamadas a la API de Claude — siempre vía backend/edge function, nunca exponer la key en cliente
export async function generarBorrador({ tipo, asunto, descripcion, remitente }) {
  // TODO Fase 2: implementar via Supabase Edge Function
  throw new Error('generarBorrador: no implementado aún')
}
