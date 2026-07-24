import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

export const deviceRoutes = Router()

deviceRoutes.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .order('name')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})
