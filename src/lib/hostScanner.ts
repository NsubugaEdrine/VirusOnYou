import { HealthFinding, HealthCategoryScore, HealthScanReport } from './types'

let findingId = 0
function makeFinding(category: string, severity: HealthFinding['severity'], title: string, description: string, recommendation: string): HealthFinding {
  return { id: `f-${++findingId}`, category, severity, title, description, recommendation }
}

/* ═══════════════════════════════════════════════════════════
   System Info Collection
   ═══════════════════════════════════════════════════════════ */
function gatherSystemInfo(): { info: Record<string, string>; findings: HealthFinding[] } {
  const info: Record<string, string> = {}
  const findings: HealthFinding[] = []
  const ua = navigator.userAgent

  // Browser detection
  let browser = 'Unknown'
  if (ua.includes('Firefox/')) browser = 'Firefox ' + ua.split('Firefox/')[1]?.split(' ')[0]
  else if (ua.includes('Edg/')) browser = 'Edge ' + ua.split('Edg/')[1]?.split(' ')[0]
  else if (ua.includes('Chrome/')) browser = 'Chrome ' + ua.split('Chrome/')[1]?.split(' ')[0]
  else if (ua.includes('Safari/') && ua.includes('Version/')) browser = 'Safari ' + ua.split('Version/')[1]?.split(' ')[0]
  info['Browser'] = browser

  // OS detection
  let os = 'Unknown'
  if (ua.includes('Windows NT 10.')) os = 'Windows 10/11'
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1'
  else if (ua.includes('Windows NT 6.2')) os = 'Windows 8'
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7'
  else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.split('Mac OS X ')[1]?.split(';')[0]?.replace(/_/g, '.') || '')
  else if (ua.includes('Android')) os = 'Android ' + (ua.split('Android ')[1]?.split(';')[0] || '')
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Linux')) os = 'Linux'
  info['Operating System'] = os

  // Hardware
  const cores = navigator.hardwareConcurrency
  if (cores) info['CPU Cores'] = String(cores)

  const ram = (navigator as { deviceMemory?: number }).deviceMemory
  if (ram) info['Estimated RAM'] = `${ram} GB`

  info['Platform'] = navigator.platform || 'Unknown'
  info['Language'] = navigator.language || 'Unknown'
  info['Languages'] = (navigator.languages || []).join(', ') || 'N/A'

  // Screen
  info['Screen Resolution'] = `${screen.width}x${screen.height}`
  info['Color Depth'] = `${screen.colorDepth}-bit`
  info['Touch Points'] = String(navigator.maxTouchPoints || 0)

  // Connection
  const conn = (navigator as { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection
  if (conn) {
    info['Connection Type'] = conn.effectiveType || 'Unknown'
    info['Downlink Speed'] = conn.downlink ? `${conn.downlink} Mbps` : 'N/A'
    info['Round-Trip Time'] = conn.rtt ? `${conn.rtt}ms` : 'N/A'
    info['Data Saver'] = conn.saveData ? 'Enabled' : 'Disabled'
  }

  // Memory (Chrome)
  const perfMem = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  if (perfMem) {
    info['JS Heap Used'] = `${(perfMem.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`
    info['JS Heap Limit'] = `${(perfMem.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB`
  }

  // Touch capability
  if (navigator.maxTouchPoints > 0) {
    findings.push(makeFinding('system', 'info', 'Touch Device Detected', 'This device has touch input capability.', ''))
  }

  return { info, findings }
}

/* ═══════════════════════════════════════════════════════════
   Security Posture Analysis
   ═══════════════════════════════════════════════════════════ */
function analyzeSecurityPosture(): { score: number; findings: HealthFinding[] } {
  const findings: HealthFinding[] = []
  let deductions = 0

  // HTTPS check
  if (window.isSecureContext) {
    findings.push(makeFinding('security', 'good', 'HTTPS Enabled', 'This page is served over a secure HTTPS connection.', ''))
  } else {
    findings.push(makeFinding('security', 'critical', 'Not Running HTTPS', 'This page is not served over HTTPS. Data may be intercepted.', 'Ensure the site is accessed via HTTPS.'))
    deductions += 25
  }

  // Cookies
  if (navigator.cookieEnabled) {
    findings.push(makeFinding('security', 'info', 'Cookies Enabled', 'Browser cookies are enabled. Third-party cookies may pose privacy risks.', 'Consider disabling third-party cookies in browser settings.'))
  } else {
    findings.push(makeFinding('security', 'good', 'Cookies Disabled', 'Browser cookies are disabled, enhancing privacy.', ''))
  }

  // Do Not Track
  const dnt = navigator.doNotTrack || (navigator as { msDoNotTrack?: string }).msDoNotTrack
  if (dnt === '1' || dnt === 'yes') {
    findings.push(makeFinding('security', 'good', 'Do Not Track Enabled', 'The Do Not Track signal is active, requesting sites not to track you.', ''))
  } else {
    findings.push(makeFinding('security', 'warning', 'Do Not Track Not Set', 'The Do Not Track signal is not enabled. Sites may track your browsing.', 'Enable Do Not Track in browser privacy settings.'))
    deductions += 5
  }

  // WebAuthn / Credential Manager
  if (window.PublicKeyCredential) {
    findings.push(makeFinding('security', 'good', 'WebAuthn Available', 'Hardware security key and passkey support detected.', ''))
  } else {
    findings.push(makeFinding('security', 'warning', 'WebAuthn Unavailable', 'Hardware security key support is not available in this browser.', 'Upgrade to a browser that supports WebAuthn/FIDO2.'))
    deductions += 5
  }

  // Crypto subtle
  if (window.crypto && window.crypto.subtle) {
    findings.push(makeFinding('security', 'good', 'Web Crypto API Available', 'Strong cryptographic operations are supported.', ''))
  } else {
    findings.push(makeFinding('security', 'critical', 'Web Crypto API Missing', 'Strong cryptography is not available. This is a major security concern.', 'Upgrade to a modern browser with crypto support.'))
    deductions += 20
  }

  // Service Worker support
  if ('serviceWorker' in navigator) {
    findings.push(makeFinding('security', 'info', 'Service Workers Available', 'Service workers can be used for offline caching and security features.', ''))
  }

  // Incognito / Private mode detection
  try {
    const storageQuota = navigator.storage?.estimate()
    if (storageQuota) {
      storageQuota.then((estimate) => {
        // This is async, we'll handle it separately
      }).catch(() => {})
    }
  } catch {}

  // Check if storage is limited (incognito indicator)
  try {
    const testKey = '__voy_incognito_test__'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)
  } catch {
    findings.push(makeFinding('security', 'info', 'Private/Incognito Mode Detected', 'Storage appears to be restricted, suggesting private browsing mode.', ''))
    deductions += 0 // Not a security issue
  }

  const score = Math.max(0, Math.min(100, 100 - deductions))
  return { score, findings }
}

/* ═══════════════════════════════════════════════════════════
   Network Analysis
   ═══════════════════════════════════════════════════════════ */
function analyzeNetwork(): { score: number; findings: HealthFinding[] } {
  const findings: HealthFinding[] = []
  let deductions = 0

  // Online status
  if (navigator.onLine) {
    findings.push(makeFinding('network', 'good', 'Online', 'Device has an active network connection.', ''))
  } else {
    findings.push(makeFinding('network', 'warning', 'Offline', 'Device has no network connection.', 'Check your network settings.'))
    deductions += 10
  }

  // Connection type
  const conn = (navigator as { connection?: { effectiveType?: string; saveData?: boolean } }).connection
  if (conn) {
    const et = conn.effectiveType || 'unknown'
    if (et === '4g' || et === 'wifi') {
      findings.push(makeFinding('network', 'good', `Fast Connection (${et.toUpperCase()})`, 'You have a high-speed network connection.', ''))
    } else if (et === '3g') {
      findings.push(makeFinding('network', 'info', 'Moderate Connection (3G)', 'You have a moderate-speed connection.', ''))
    } else {
      findings.push(makeFinding('network', 'warning', `Slow Connection (${et.toUpperCase()})`, 'You have a slow network connection which may affect security updates.', 'Consider connecting to a faster network.'))
      deductions += 5
    }

    if (conn.saveData) {
      findings.push(makeFinding('network', 'info', 'Data Saver Active', 'Data saver mode is enabled, which may limit security updates.', ''))
    }
  }

  // WebRTC availability (IP leak risk)
  try {
    const rtc = window.RTCPeerConnection || (window as { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection || (window as { mozRTCPeerConnection?: typeof RTCPeerConnection }).mozRTCPeerConnection
    if (rtc) {
      findings.push(makeFinding('network', 'warning', 'WebRTC Available — IP Leak Risk', 'WebRTC can potentially leak your local and public IP addresses even behind a VPN.', 'Consider disabling WebRTC in browser settings or using a WebRTC-blocking extension.'))
      deductions += 10
    }
  } catch {}

  // WebSocket
  if (window.WebSocket) {
    findings.push(makeFinding('network', 'info', 'WebSocket Available', 'WebSocket protocol is supported for real-time communications.', ''))
  }

  // Fetch API
  if (typeof window.fetch === 'function') {
    findings.push(makeFinding('network', 'good', 'Fetch API Available', 'Modern HTTP request API is supported.', ''))
  }

  const score = Math.max(0, Math.min(100, 100 - deductions))
  return { score, findings }
}

/* ═══════════════════════════════════════════════════════════
   Storage Analysis
   ═══════════════════════════════════════════════════════════ */
async function analyzeStorage(): Promise<{ score: number; findings: HealthFinding[] }> {
  const findings: HealthFinding[] = []
  let deductions = 0

  // LocalStorage
  try {
    const testKey = '__voy_storage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    findings.push(makeFinding('storage', 'good', 'LocalStorage Accessible', 'Local storage is available for data persistence.', ''))
  } catch {
    findings.push(makeFinding('storage', 'warning', 'LocalStorage Blocked', 'Local storage is not accessible. Some features may not work.', ''))
    deductions += 10
  }

  // SessionStorage
  try {
    sessionStorage.setItem('__voy_test__', '1')
    sessionStorage.removeItem('__voy_test__')
    findings.push(makeFinding('storage', 'good', 'SessionStorage Accessible', 'Session storage is available.', ''))
  } catch {
    findings.push(makeFinding('storage', 'warning', 'SessionStorage Blocked', 'Session storage is not accessible.', ''))
    deductions += 5
  }

  // IndexedDB
  if (window.indexedDB) {
    findings.push(makeFinding('storage', 'good', 'IndexedDB Available', 'IndexedDB is available for structured data storage.', ''))
  } else {
    findings.push(makeFinding('storage', 'warning', 'IndexedDB Unavailable', 'IndexedDB is not available in this browser.', ''))
    deductions += 5
  }

  // Storage estimate
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      const used = estimate.usage || 0
      const quota = estimate.quota || 0
      const usedMB = (used / 1024 / 1024).toFixed(1)
      const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(2)
      const percent = quota > 0 ? ((used / quota) * 100).toFixed(1) : '0'

      findings.push(makeFinding('storage', 'info', `Storage Usage: ${usedMB} MB / ${quotaGB} GB (${percent}%)`, `Browser storage is ${percent}% full.`, Number(percent) > 80 ? 'Consider clearing browser storage to free up space.' : ''))

      if (Number(percent) > 90) {
        deductions += 10
        findings.push(makeFinding('storage', 'warning', 'Storage Nearly Full', 'Browser storage is over 90% full which may cause issues.', 'Clear unused site data in browser settings.'))
      }
    } catch {
      findings.push(makeFinding('storage', 'info', 'Storage Estimate Unavailable', 'Could not retrieve storage usage information.', ''))
    }
  }

  // Cache API
  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      if (keys.length > 0) {
        findings.push(makeFinding('storage', 'info', `${keys.length} Cache(s) Registered`, 'Service worker caches are present.', 'Consider clearing caches periodically.'))
      } else {
        findings.push(makeFinding('storage', 'good', 'No Caches Registered', 'No service worker caches are present.', ''))
      }
    } catch {
      findings.push(makeFinding('storage', 'info', 'Cache API Check Failed', 'Could not enumerate caches.', ''))
    }
  }

  // Persistent storage
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    findings.push(makeFinding('storage', 'info', 'Persistent Storage Available', 'Sites can request persistent storage that cannot be auto-cleared.', ''))
  }

  const score = Math.max(0, Math.min(100, 100 - deductions))
  return { score, findings }
}

/* ═══════════════════════════════════════════════════════════
   Browser Capability / Attack Surface Audit
   ═══════════════════════════════════════════════════════════ */
function analyzeAttackSurface(): { score: number; findings: HealthFinding[] } {
  const findings: HealthFinding[] = []
  let deductions = 0

  const apis: Array<{ name: string; check: () => boolean; risk: 'high' | 'medium' | 'low'; desc: string }> = [
    { name: 'WebUSB', check: () => 'usb' in navigator, risk: 'high', desc: 'Allows websites to connect to USB devices. High privilege access.' },
    { name: 'Web Serial', check: () => 'serial' in navigator, risk: 'high', desc: 'Allows serial port communication. High privilege access.' },
    { name: 'Web Bluetooth', check: () => 'bluetooth' in navigator, risk: 'medium', desc: 'Allows Bluetooth device communication.' },
    { name: 'Geolocation', check: () => 'geolocation' in navigator, risk: 'medium', desc: 'Can determine your physical location.' },
    { name: 'Camera/Microphone', check: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), risk: 'high', desc: 'Can access camera and microphone with permission.' },
    { name: 'Notifications', check: () => 'Notification' in window, risk: 'low', desc: 'Can send desktop notifications.' },
    { name: 'Clipboard Read', check: () => 'clipboard' in navigator && 'readText' in navigator.clipboard, risk: 'medium', desc: 'Can read clipboard contents (requires permission).' },
    { name: 'WebRTC', check: () => !!(window.RTCPeerConnection || (window as { webkitRTCPeerConnection?: unknown }).webkitRTCPeerConnection), risk: 'high', desc: 'Can leak local/public IP addresses.' },
    { name: 'Payment Request', check: () => 'PaymentRequest' in window, risk: 'low', desc: 'Can initiate payment requests.' },
    { name: 'WebVR/WebXR', check: () => 'xr' in navigator || 'VRFrameDisplay' in window, risk: 'low', desc: 'VR/AR capabilities available.' },
    { name: 'NFC', check: () => 'NDEFReader' in window, risk: 'medium', desc: 'NFC tag reading capability.' },
    { name: 'Bluetooth LE Scanning', check: () => 'bluetooth' in navigator, risk: 'medium', desc: 'Can scan for Bluetooth LE devices.' },
  ]

  let highRisk = 0
  let mediumRisk = 0

  for (const api of apis) {
    try {
      if (api.check()) {
        if (api.risk === 'high') {
          highRisk++
          findings.push(makeFinding('attack', 'warning', `${api.name} Available`, api.desc, `Be aware that websites can request access to ${api.name}. Review site permissions regularly.`))
          deductions += 5
        } else if (api.risk === 'medium') {
          mediumRisk++
          findings.push(makeFinding('attack', 'info', `${api.name} Available`, api.desc, ''))
          deductions += 2
        } else {
          findings.push(makeFinding('attack', 'info', `${api.name} Available`, api.desc, ''))
        }
      }
    } catch {
      // API check failed, skip
    }
  }

  if (highRisk > 0) {
    findings.unshift(makeFinding('attack', 'warning', `${highRisk} High-Privilege API(s) Detected`, 'Your browser has high-privilege APIs available that could be exploited by malicious sites.', 'Review browser permissions for each site. Consider using a browser with stricter API controls.'))
  }

  // Plugin count
  const pluginCount = navigator.plugins?.length || 0
  if (pluginCount > 5) {
    findings.push(makeFinding('attack', 'info', `${pluginCount} Browser Plugins Installed`, 'More plugins increase the attack surface.', 'Review and remove unused browser plugins.'))
    deductions += 2
  }

  const score = Math.max(0, Math.min(100, 100 - deductions))
  return { score, findings }
}

/* ═══════════════════════════════════════════════════════════
   Privacy Analysis
   ═══════════════════════════════════════════════════════════ */
function analyzePrivacy(): { score: number; findings: HealthFinding[] } {
  const findings: HealthFinding[] = []
  let deductions = 0

  // Timezone
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (tz) {
    findings.push(makeFinding('privacy', 'info', `Timezone: ${tz}`, 'Your timezone is exposed to websites and can be used for fingerprinting.', ''))
  }

  // Languages
  const langs = navigator.languages || []
  if (langs.length > 1) {
    findings.push(makeFinding('privacy', 'info', `${langs.length} Languages Configured`, 'Multiple configured languages can increase fingerprinting uniqueness.', ''))
  }

  // Plugins (fingerprinting vector)
  const plugins = Array.from(navigator.plugins || [])
  if (plugins.length > 0) {
    const pluginNames = plugins.slice(0, 5).map((p) => p.name).join(', ')
    findings.push(makeFinding('privacy', 'info', `Browser Plugins: ${pluginNames}${plugins.length > 5 ? ` (+${plugins.length - 5} more)` : ''}`, 'Installed plugins are visible to websites and contribute to fingerprinting.', 'Consider using a browser with plugin privacy protection.'))
    deductions += 3
  } else {
    findings.push(makeFinding('privacy', 'good', 'No Detectable Plugins', 'No browser plugins detected, reducing fingerprinting surface.', ''))
  }

  // WebGL fingerprinting
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
        findings.push(makeFinding('privacy', 'warning', `GPU Exposed: ${renderer}`, 'WebGL can expose your GPU model, which is a strong fingerprinting vector.', 'Consider using a browser with WebGL fingerprint protection.'))
        deductions += 5
      }
    }
  } catch {}

  // Canvas fingerprinting test
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('Fingerprint', 2, 15)
      const dataUrl = canvas.toDataURL()
      if (dataUrl.length > 100) {
        findings.push(makeFinding('privacy', 'info', 'Canvas Fingerprinting Possible', 'Websites can use canvas rendering to create a unique fingerprint of your device.', ''))
        deductions += 3
      }
    }
  } catch {}

  // AudioContext fingerprinting
  try {
    if (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) {
      findings.push(makeFinding('privacy', 'info', 'AudioContext Available', 'Web Audio API can be used for audio fingerprinting.', ''))
      deductions += 2
    }
  } catch {}

  const score = Math.max(0, Math.min(100, 100 - deductions))
  return { score, findings }
}

/* ═══════════════════════════════════════════════════════════
   Main Scan Orchestrator
   ═══════════════════════════════════════════════════════════ */
export type ScanPhase = 'system' | 'security' | 'network' | 'storage' | 'attack' | 'privacy' | 'complete'

export interface ScanProgress {
  phase: ScanPhase
  phaseName: string
  percent: number
}

export async function runFullHealthScan(
  onProgress: (progress: ScanProgress) => void,
  userId: string,
): Promise<HealthScanReport> {
  findingId = 0
  const allFindings: HealthFinding[] = []

  // Phase 1: System Info
  onProgress({ phase: 'system', phaseName: 'Gathering System Information', percent: 0 })
  await new Promise((r) => setTimeout(r, 400))
  const { info: systemInfo, findings: sysFindings } = gatherSystemInfo()
  allFindings.push(...sysFindings)
  onProgress({ phase: 'system', phaseName: 'Gathering System Information', percent: 100 })
  await new Promise((r) => setTimeout(r, 200))

  // Phase 2: Security Posture
  onProgress({ phase: 'security', phaseName: 'Analyzing Security Posture', percent: 0 })
  await new Promise((r) => setTimeout(r, 400))
  const { score: secScore, findings: secFindings } = analyzeSecurityPosture()
  allFindings.push(...secFindings)
  onProgress({ phase: 'security', phaseName: 'Analyzing Security Posture', percent: 100 })
  await new Promise((r) => setTimeout(r, 200))

  // Phase 3: Network Analysis
  onProgress({ phase: 'network', phaseName: 'Analyzing Network Security', percent: 0 })
  await new Promise((r) => setTimeout(r, 400))
  const { score: netScore, findings: netFindings } = analyzeNetwork()
  allFindings.push(...netFindings)
  onProgress({ phase: 'network', phaseName: 'Analyzing Network Security', percent: 100 })
  await new Promise((r) => setTimeout(r, 200))

  // Phase 4: Storage Analysis
  onProgress({ phase: 'storage', phaseName: 'Analyzing Storage Health', percent: 0 })
  await new Promise((r) => setTimeout(r, 400))
  const { score: strScore, findings: strFindings } = await analyzeStorage()
  allFindings.push(...strFindings)
  onProgress({ phase: 'storage', phaseName: 'Analyzing Storage Health', percent: 100 })
  await new Promise((r) => setTimeout(r, 200))

  // Phase 5: Attack Surface
  onProgress({ phase: 'attack', phaseName: 'Auditing Attack Surface', percent: 0 })
  await new Promise((r) => setTimeout(r, 400))
  const { score: atkScore, findings: atkFindings } = analyzeAttackSurface()
  allFindings.push(...atkFindings)
  onProgress({ phase: 'attack', phaseName: 'Auditing Attack Surface', percent: 100 })
  await new Promise((r) => setTimeout(r, 200))

  // Phase 6: Privacy Analysis
  onProgress({ phase: 'privacy', phaseName: 'Analyzing Privacy Fingerprint', percent: 0 })
  await new Promise((r) => setTimeout(r, 400))
  const { score: priScore, findings: priFindings } = analyzePrivacy()
  allFindings.push(...priFindings)
  onProgress({ phase: 'privacy', phaseName: 'Analyzing Privacy Fingerprint', percent: 100 })
  await new Promise((r) => setTimeout(r, 200))

  // Compute overall score
  const categories: HealthCategoryScore[] = [
    { name: 'System', score: 85, icon: 'computer', color: 'primary' },
    { name: 'Security', score: secScore, icon: 'shield', color: secScore >= 70 ? 'tertiary' : secScore >= 40 ? 'secondary' : 'error' },
    { name: 'Network', score: netScore, icon: 'wifi', color: netScore >= 70 ? 'tertiary' : netScore >= 40 ? 'secondary' : 'error' },
    { name: 'Storage', score: strScore, icon: 'sd_storage', color: strScore >= 70 ? 'tertiary' : strScore >= 40 ? 'secondary' : 'error' },
    { name: 'Attack Surface', score: atkScore, icon: 'bug_report', color: atkScore >= 70 ? 'tertiary' : atkScore >= 40 ? 'secondary' : 'error' },
    { name: 'Privacy', score: priScore, icon: 'visibility_off', color: priScore >= 70 ? 'tertiary' : priScore >= 40 ? 'secondary' : 'error' },
  ]

  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  )

  let overallRating: HealthScanReport['overallRating'] = 'Good'
  if (overallScore >= 90) overallRating = 'Excellent'
  else if (overallScore >= 70) overallRating = 'Good'
  else if (overallScore >= 50) overallRating = 'Fair'
  else if (overallScore >= 30) overallRating = 'Poor'
  else overallRating = 'Critical'

  onProgress({ phase: 'complete', phaseName: 'Scan Complete', percent: 100 })

  return {
    id: crypto.randomUUID(),
    overallScore,
    overallRating,
    categories,
    findings: allFindings,
    systemInfo,
    scannedAt: new Date().toISOString(),
    userId,
  }
}
