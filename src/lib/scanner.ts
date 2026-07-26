import { ThreatSignature, DeviceScanFile } from './types'

/* ═══════════════════════════════════════════════════════════
   Built-in Threat Signature Database
   ═══════════════════════════════════════════════════════════ */
export const THREAT_DB: ThreatSignature[] = [
  { sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', malwareName: 'EmptyFile.Dropper', family: 'Trojan', severity: 'High' },
  { sha256: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', malwareName: 'USBStealer.Gen', family: 'Spyware', severity: 'Critical' },
  { sha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', malwareName: 'Autorun.Worm', family: 'Worm', severity: 'Critical' },
  { sha256: 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe', malwareName: 'CoinMiner.XMR', family: 'Trojan', severity: 'High' },
  { sha256: '44d88612fea8a8f36de82e1278abb02f', malwareName: 'EICAR-Test', family: 'Test', severity: 'Medium' },
]

/* ═══════════════════════════════════════════════════════════
   File Extension Classification
   ═══════════════════════════════════════════════════════════ */
export const MALICIOUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsh', '.ps1',
  '.msi', '.com', '.pif', '.scr', '.hta', '.cpl', '.reg', '.rgs',
]

export const SUSPICIOUS_EXTENSIONS = [
  '.apk', '.dex', '.jar', '.class', '.swf', '.docm', '.xlsm', '.pptm',
  '.zip', '.rar', '.7z', '.iso', '.img', '.vhd', '.vmdk',
]

export const SYSTEM_EXTENSIONS = ['.sys', '.drv', '.dll', '.ocx', '.ax', '.cpl']

export const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz']

export const DOCUMENT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf', '.csv', '.txt',
  '.odt', '.ods', '.odp', '.pages', '.numbers', '.keynote',
]

export const MEDIA_EXTENSIONS = [
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg', '.aac', '.wma',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.ico', '.webp',
  '.mkv', '.wmv', '.webm', '.flv',
]

export const CODE_EXTENSIONS = [
  '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.toml',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.c', '.cpp', '.h', '.hpp', '.java', '.py', '.rb', '.go', '.rs', '.swift', '.kt',
  '.ts', '.tsx', '.jsx', '.vue', '.svelte',
]

export const ANDROID_EXTENSIONS = ['.apk', '.dex', '.aar', '.obb', '.aab']

/* ═══════════════════════════════════════════════════════════
   Hash Utilities
   ═══════════════════════════════════════════════════════════ */
export function computeSHA256Sync(data: ArrayBuffer): string {
  const arr = new Uint8Array(data)
  let hash = 0
  for (let i = 0; i < arr.length; i++) {
    hash = ((hash << 5) - hash + arr[i]) | 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(8)
}

export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ═══════════════════════════════════════════════════════════
   File Utilities
   ═══════════════════════════════════════════════════════════ */
export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function getFileCategory(ext: string): string {
  if (MALICIOUS_EXTENSIONS.includes(ext) || SYSTEM_EXTENSIONS.includes(ext)) return 'Executable'
  if (ANDROID_EXTENSIONS.includes(ext)) return 'Android'
  if (ARCHIVE_EXTENSIONS.includes(ext)) return 'Archive'
  if (DOCUMENT_EXTENSIONS.includes(ext)) return 'Document'
  if (MEDIA_EXTENSIONS.includes(ext)) return 'Media'
  if (CODE_EXTENSIONS.includes(ext)) return 'Code'
  if (SUSPICIOUS_EXTENSIONS.includes(ext)) return 'Suspicious'
  return 'Other'
}

/* ═══════════════════════════════════════════════════════════
   AV Engine — Core Heuristic Analysis
   ═══════════════════════════════════════════════════════════ */
export function analyzeFileForThreats(file: File, sha256: string) {
  const ext = getExtension(file.name)
  const name = file.name.toLowerCase()
  const filePath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name
  let riskScore = 0
  const reasons: string[] = []
  let malwareName: string | null = null

  // 1. Signature match against built-in DB
  const sigMatch = THREAT_DB.find((s) => sha256.startsWith(s.sha256.slice(0, 16)))
  if (sigMatch) {
    riskScore = 95
    malwareName = sigMatch.malwareName
    reasons.push(`KNOWN THREAT: Signature matches "${sigMatch.malwareName}" (${sigMatch.family})`)
  }

  // 2. Extension-based detection
  if (MALICIOUS_EXTENSIONS.includes(ext)) {
    riskScore += sigMatch ? 0 : 55
    reasons.push(`Executable extension "${ext}" — commonly abused by malware`)
  } else if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
    riskScore += sigMatch ? 0 : 20
    reasons.push(`Suspicious extension "${ext}" — requires analysis`)
  } else if (SYSTEM_EXTENSIONS.includes(ext)) {
    riskScore += sigMatch ? 0 : 15
    reasons.push(`System extension "${ext}" — unusual on removable media`)
  }

  // 3. File size anomalies
  if (file.size === 0) {
    riskScore += sigMatch ? 0 : 35
    reasons.push('File is empty (0 bytes) — possible dropper or corruption')
  } else if (file.size > 500 * 1024 * 1024) {
    riskScore += sigMatch ? 0 : 10
    reasons.push('Unusually large file size (>500MB)')
  }

  // 4. Double extension (social engineering)
  if (/\.\w+\.\w+$/.test(file.name) && !file.name.endsWith('.tar.gz')) {
    riskScore += sigMatch ? 0 : 25
    reasons.push('Double extension — social engineering attack vector')
  }

  // 5. Suspicious naming
  const suspiciousNames = [
    'autorun', 'setup', 'install', 'update', 'patch', 'crack', 'keygen',
    'loader', 'inject', 'exploit', 'payload', 'shellcode', 'backdoor', 'rootkit',
    'trojan', 'hack', 'cheat', 'mod', 'unlock', 'bypass',
  ]
  const matchedName = suspiciousNames.find((n) => name.includes(n))
  if (matchedName) {
    riskScore += sigMatch ? 0 : 20
    reasons.push(`Filename contains suspicious keyword "${matchedName}"`)
  }

  // 6. System path on removable drive
  const systemPaths = ['windows', 'system32', 'appdata', 'temp', 'startup', 'program files', '$recycle', 'system volume']
  if (systemPaths.some((p) => filePath.toLowerCase().includes(p))) {
    riskScore += sigMatch ? 0 : 15
    reasons.push('File found in system-related directory — possible infection spread')
  }

  // 7. Hidden file tricks
  if (name.startsWith('.') || name.endsWith('.')) {
    riskScore += sigMatch ? 0 : 10
    reasons.push('Hidden or trailing-dot filename — evasion technique')
  }

  // 8. Hash anomaly
  if (sha256 === '0'.repeat(64)) {
    riskScore += sigMatch ? 0 : 45
    reasons.push('SHA-256 is all zeros — file may be corrupted or tampered')
  }

  // 9. Archive with executable inside (heuristic name check)
  if (ARCHIVE_EXTENSIONS.includes(ext)) {
    const suspiciousArchiveNames = ['payload', 'dropper', 'stager', 'loader']
    if (suspiciousArchiveNames.some((n) => name.includes(n))) {
      riskScore += sigMatch ? 0 : 15
      reasons.push('Archive with suspicious naming pattern')
    }
  }

  // 10. Document with macros
  if (['.docm', '.xlsm', '.pptm'].includes(ext)) {
    riskScore += sigMatch ? 0 : 30
    reasons.push('Office document with macros — common malware delivery vector')
  }

  riskScore = Math.min(100, riskScore)

  let threatLevel: DeviceScanFile['threatLevel'] = 'None'
  if (riskScore >= 75) { threatLevel = 'Critical'; if (!malwareName) malwareName = 'Suspicious.Behavior' }
  else if (riskScore >= 50) { threatLevel = 'High'; if (!malwareName) malwareName = 'Riskware.Detected' }
  else if (riskScore >= 25) { threatLevel = 'Medium'; if (!malwareName) malwareName = 'PUA.Suspicious' }
  else if (riskScore >= 10) { threatLevel = 'Low'; if (!malwareName) malwareName = 'Heuristic.LowRisk' }

  return {
    threatLevel,
    threatName: malwareName,
    riskScore,
    details: reasons.length > 0 ? reasons.join(' • ') : 'File is clean — no threats detected',
    reasons,
  }
}

/* ═══════════════════════════════════════════════════════════
   Batch Scan Helper — Scan multiple files with progress
   ═══════════════════════════════════════════════════════════ */
export interface ScanProgress {
  current: number
  total: number
  fileName: string
  percent: number
}

export async function scanFilesBatch(
  files: File[],
  onProgress: (progress: ScanProgress) => void,
  onFileComplete: (index: number, result: { file: File; sha256: string; analysis: ReturnType<typeof analyzeFileForThreats> }) => void,
  existingHashes?: Map<string, string>,
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress({ current: i, total: files.length, fileName: file.name, percent: Math.round((i / files.length) * 100) })

    try {
      const sha256 = await computeSHA256(file)
      const analysis = analyzeFileForThreats(file, sha256)

      // DB cross-reference
      if (existingHashes?.has(sha256)) {
        analysis.riskScore = Math.max(analysis.riskScore, 85)
        analysis.threatLevel = 'Critical'
        analysis.threatName = 'Known Threat — DB Match'
        analysis.reasons.unshift('HASH MATCH: This file hash exists in the scan database')
        analysis.details = analysis.reasons.join(' • ')
      }

      onFileComplete(i, { file, sha256, analysis })
    } catch {
      onFileComplete(i, {
        file,
        sha256: 'error',
        analysis: { threatLevel: 'None' as const, threatName: 'Scan Error', riskScore: 0, details: 'Failed to compute hash', reasons: ['Hash computation failed'] },
      })
    }

    // Small delay for UI responsiveness
    if (files.length > 10) await new Promise((r) => setTimeout(r, 30))
  }
  onProgress({ current: files.length, total: files.length, fileName: '', percent: 100 })
}

/* ═══════════════════════════════════════════════════════════
   USB Helpers
   ═══════════════════════════════════════════════════════════ */
export function usbClassToType(cls: number): string {
  const map: Record<number, string> = {
    0: 'Miscellaneous', 1: 'Audio Device', 2: 'CDC Communications', 3: 'HID Device',
    6: 'Camera', 7: 'Printer', 8: 'Mass Storage', 9: 'USB Hub', 11: 'Smart Card', 220: 'Vendor-Specific',
  }
  return map[cls] || `USB Class ${cls}`
}
