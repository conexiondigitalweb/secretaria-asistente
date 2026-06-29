import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDocumentos() {
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => { fetchDocumentos() }, [])

  async function fetchDocumentos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('documentos')
      .select('id, nombre, tipo, descripcion, archivo_url, vigente, procesado, paginas, tamano_kb, contenido, created_at')
      .order('created_at', { ascending: false })
    if (error) setError(error)
    else setDocumentos(data ?? [])
    setLoading(false)
  }

  async function crearDocumento(doc) {
    const { data, error } = await supabase
      .from('documentos')
      .insert([doc])
      .select()
      .single()
    if (error) throw error
    setDocumentos(prev => [data, ...prev])
    return data
  }

  async function actualizarDocumento(id, cambios) {
    const { data, error } = await supabase
      .from('documentos')
      .update(cambios)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setDocumentos(prev => prev.map(d => d.id === id ? data : d))
    return data
  }

  async function eliminarDocumento(id, archivoUrl) {
    // Eliminar del Storage si existe URL
    if (archivoUrl) {
      const path = archivoUrl.split('/documentos-institucionales/')[1]
      if (path) {
        await supabase.storage.from('documentos-institucionales').remove([path])
      }
    }
    const { error } = await supabase.from('documentos').delete().eq('id', id)
    if (error) throw error
    setDocumentos(prev => prev.filter(d => d.id !== id))
  }

  async function buscarSimilares(queryEmbedding, matchCount = 3, umbral = 0.3) {
    const { data, error } = await supabase.rpc('buscar_documentos_similares', {
      query_embedding:  queryEmbedding,
      match_count:      matchCount,
      umbral_similitud: umbral,
    })
    if (error) throw error
    return data ?? []
  }

  return {
    documentos, loading, error,
    crearDocumento, actualizarDocumento, eliminarDocumento,
    buscarSimilares,
    refetch: fetchDocumentos,
  }
}
