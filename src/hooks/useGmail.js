import { useState, useEffect, useCallback } from 'react'
import {
  estadoConexionGmail,
  iniciarAuthGmail,
  desconectarGmail,
  listarCorreosRecientes,
} from '../lib/gmail'

export function useGmail(usuarioEmail) {
  const [estado, setEstado]       = useState(null)   // null | { conectado, expires_at, ... }
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [correos, setCorreos]     = useState([])
  const [cargandoCorreos, setCargandoCorreos] = useState(false)

  const cargarEstado = useCallback(async () => {
    if (!usuarioEmail) return
    setLoading(true)
    setError(null)
    try {
      const e = await estadoConexionGmail(usuarioEmail)
      setEstado(e)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [usuarioEmail])

  useEffect(() => { cargarEstado() }, [cargarEstado])

  function conectar() {
    try {
      iniciarAuthGmail()
    } catch (err) {
      setError(err.message)
    }
  }

  async function desconectar() {
    if (!usuarioEmail) return
    setLoading(true)
    setError(null)
    try {
      await desconectarGmail(usuarioEmail)
      setEstado({ conectado: false })
      setCorreos([])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function cargarCorreos(max = 10) {
    if (!usuarioEmail) return
    setCargandoCorreos(true)
    setError(null)
    try {
      const lista = await listarCorreosRecientes(usuarioEmail, max)
      setCorreos(lista)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoCorreos(false)
    }
  }

  return {
    estado,
    loading,
    error,
    correos,
    cargandoCorreos,
    conectar,
    desconectar,
    cargarCorreos,
    refetch: cargarEstado,
  }
}
