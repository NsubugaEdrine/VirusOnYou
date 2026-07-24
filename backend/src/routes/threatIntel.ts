import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

export const threatIntelRoutes = Router()

threatIntelRoutes.get('/', async (req, res) => {
  const { q } = req.query

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter q is required' })
  }

  const { data, error } = await supabase
    .from('threat_intel')
    .select('*')
    .or(`package_name.ilike.%${q}%,malware_family.ilike.%${q}%`)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})
