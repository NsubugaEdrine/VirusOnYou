import 'dotenv/config'
import { supabase } from '../lib/supabase.js'

async function seed() {
  console.log('Seeding database...')

  const { error: scansError } = await supabase.from('scans').insert([
    {
      file_name: 'com.example.banking.app',
      package_name: 'com.example.banking.app',
      version: '2.1.0',
      sha256: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 'Complete',
      threat_level: 'Critical',
      risk_category: 'Banking Trojan',
      malware_name: 'TrojanSpy.AndroidOS.FakeBank',
      risk_score: 85,
      uploaded_at: '2024-11-15 10:30:00+00',
      completed_at: '2024-11-15 10:35:00+00',
      scan_types: ['Manifest Analysis', 'Permission Analysis', 'Code Analysis', 'Network Analysis'],
    },
    {
      file_name: 'com.example.social.app',
      package_name: 'com.example.social.app',
      version: '3.4.1',
      sha256: 'b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1',
      status: 'Complete',
      threat_level: 'High',
      risk_category: 'Spyware',
      malware_name: 'Spyware.AndroidOS.SocialSteal',
      risk_score: 72,
      uploaded_at: '2024-11-15 09:00:00+00',
      completed_at: '2024-11-15 09:04:00+00',
      scan_types: ['Manifest Analysis', 'Permission Analysis', 'Code Analysis'],
    },
    {
      file_name: 'com.example.utility.app',
      package_name: 'com.example.utility.app',
      version: '1.0.5',
      sha256: 'c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2',
      status: 'Complete',
      threat_level: 'Medium',
      risk_category: 'Adware',
      malware_name: null,
      risk_score: 45,
      uploaded_at: '2024-11-15 08:00:00+00',
      completed_at: '2024-11-15 08:03:00+00',
      scan_types: ['Manifest Analysis', 'Permission Analysis'],
    },
    {
      file_name: 'com.example.clean.app',
      package_name: 'com.example.clean.app',
      version: '5.2.0',
      sha256: 'd4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3',
      status: 'Complete',
      threat_level: 'Low',
      risk_category: 'Clean',
      malware_name: null,
      risk_score: 12,
      uploaded_at: '2024-11-14 16:00:00+00',
      completed_at: '2024-11-14 16:02:00+00',
      scan_types: ['Manifest Analysis', 'Permission Analysis', 'Code Analysis', 'Network Analysis'],
    },
    {
      file_name: 'com.example.games.app',
      package_name: 'com.example.games.app',
      version: '1.8.0',
      sha256: 'e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3d4',
      status: 'Complete',
      threat_level: 'Low',
      risk_category: 'Riskware',
      malware_name: null,
      risk_score: 20,
      uploaded_at: '2024-11-14 14:00:00+00',
      completed_at: '2024-11-14 14:03:00+00',
      scan_types: ['Manifest Analysis', 'Permission Analysis'],
    },
    {
      file_name: 'com.example.unknown.app',
      package_name: 'com.example.unknown.app',
      version: '0.9.1',
      sha256: 'f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3d4e5',
      status: 'In Progress',
      threat_level: 'None',
      risk_category: 'Pending',
      malware_name: null,
      risk_score: 0,
      uploaded_at: '2024-11-15 11:00:00+00',
      completed_at: null,
      scan_types: ['Manifest Analysis', 'Permission Analysis', 'Code Analysis'],
    },
    {
      file_name: 'com.example.test.app',
      package_name: 'com.example.test.app',
      version: '1.0.0',
      sha256: '7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
      status: 'Queued',
      threat_level: 'None',
      risk_category: 'Pending',
      malware_name: null,
      risk_score: 0,
      uploaded_at: '2024-11-15 11:30:00+00',
      completed_at: null,
      scan_types: ['Manifest Analysis'],
    },
  ])

  if (scansError) console.error('Scans seed error:', scansError.message)
  else console.log('Seeded scans')

  const { data: bankingScan } = await supabase
    .from('scans')
    .select('id')
    .eq('package_name', 'com.example.banking.app')
    .single()

  if (bankingScan) {
    const { error: permsError } = await supabase.from('permissions').insert([
      { scan_id: bankingScan.id, name: 'android.permission.READ_SMS', risk_level: 'High', description: 'Read SMS messages - used to intercept OTP and banking codes' },
      { scan_id: bankingScan.id, name: 'android.permission.SEND_SMS', risk_level: 'High', description: 'Send SMS - used for premium rate SMS fraud' },
      { scan_id: bankingScan.id, name: 'android.permission.READ_CONTACTS', risk_level: 'Medium', description: 'Read contacts - harvests contact list for propagation' },
      { scan_id: bankingScan.id, name: 'android.permission.ACCESS_FINE_LOCATION', risk_level: 'Medium', description: 'Fine location access - tracks user location' },
      { scan_id: bankingScan.id, name: 'android.permission.RECORD_AUDIO', risk_level: 'High', description: 'Record audio - covert surveillance capability' },
      { scan_id: bankingScan.id, name: 'android.permission.CAMERA', risk_level: 'Medium', description: 'Camera access - covert photo capture' },
      { scan_id: bankingScan.id, name: 'android.permission.READ_PHONE_STATE', risk_level: 'Low', description: 'Read phone state - device identification' },
      { scan_id: bankingScan.id, name: 'android.permission.INTERNET', risk_level: 'Low', description: 'Internet access - network communication' },
    ])

    if (permsError) console.error('Permissions seed error:', permsError.message)
    else console.log('Seeded permissions')

    const { error: networkError } = await supabase.from('network_indicators').insert([
      { scan_id: bankingScan.id, domain: 'malicious-c2.com', ip_address: '192.168.1.100', indicator_type: 'C2 Server' },
      { scan_id: bankingScan.id, domain: 'data-exfil.com', ip_address: '10.0.0.50', indicator_type: 'Data Exfiltration' },
    ])

    if (networkError) console.error('Network indicators seed error:', networkError.message)
    else console.log('Seeded network indicators')

    const { error: compsError } = await supabase.from('components').insert([
      { scan_id: bankingScan.id, component_type: 'Activity', name: 'com.example.MainActivity', risk_level: 'Low' },
      { scan_id: bankingScan.id, component_type: 'Service', name: 'com.example.SpyService', risk_level: 'High' },
      { scan_id: bankingScan.id, component_type: 'Receiver', name: 'com.example.BootReceiver', risk_level: 'Medium' },
      { scan_id: bankingScan.id, component_type: 'Provider', name: 'com.example.DataProvider', risk_level: 'High' },
    ])

    if (compsError) console.error('Components seed error:', compsError.message)
    else console.log('Seeded components')
  }

  const { error: tiError } = await supabase.from('threat_intel').insert([
    {
      package_name: 'com.example.banking.app',
      malware_family: 'FakeBank',
      severity: 'Critical',
      first_seen: '2024-11-15 10:00:00+00',
      last_seen: '2024-11-15 10:00:00+00',
      iocs: [
        { type: 'SHA256', value: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890' },
        { type: 'Domain', value: 'malicious-c2.com' },
        { type: 'IP', value: '192.168.1.100' },
      ],
      description: 'Banking trojan that intercepts SMS messages and steals banking credentials.',
    },
    {
      package_name: 'com.example.social.app',
      malware_family: 'SocialSteal',
      severity: 'High',
      first_seen: '2024-11-14 09:00:00+00',
      last_seen: '2024-11-15 09:00:00+00',
      iocs: [
        { type: 'SHA256', value: 'b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1' },
        { type: 'Domain', value: 'suspicious-domain.com' },
      ],
      description: 'Spyware targeting social media credentials and personal data.',
    },
  ])

  if (tiError) console.error('Threat intel seed error:', tiError.message)
  else console.log('Seeded threat intel')

  console.log('Seeding complete!')
}

seed().catch(console.error)
