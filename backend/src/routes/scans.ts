import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

export const scanRoutes = Router()

scanRoutes.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .order('uploaded_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

scanRoutes.get('/:id', async (req, res) => {
  const { id } = req.params

  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .single()

  if (scanError) return res.status(404).json({ error: 'Scan not found' })

  const { data: permissions } = await supabase
    .from('permissions')
    .select('*')
    .eq('scan_id', id)

  const { data: networkIndicators } = await supabase
    .from('network_indicators')
    .select('*')
    .eq('scan_id', id)

  const { data: components } = await supabase
    .from('components')
    .select('*')
    .eq('scan_id', id)

  res.json({
    scan,
    permissions: permissions || [],
    networkIndicators: networkIndicators || [],
    components: components || [],
  })
})

scanRoutes.post('/', async (req, res) => {
  const { file_name, package_name, version, sha256, scan_types } = req.body

  const { data, error } = await supabase
    .from('scans')
    .insert({
      file_name,
      package_name,
      version,
      sha256,
      status: 'Queued',
      threat_level: 'None',
      risk_score: 0,
      risk_category: '',
      scan_types,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})
