/* ═══════════════════════════════════════════════════════════
   ADB (Android Debug Bridge) Protocol over WebUSB
   Communicates with Android devices connected via USB
   ═══════════════════════════════════════════════════════════ */

const ADB_RESPONSE_OK = 'OKAY'
const ADB_RESPONSE_FAIL = 'FAIL'

export interface AdbDevice {
  device: USBDevice
  serial: string
  name: string
}

export interface InstalledApp {
  packageName: string
  apkPath: string | null
  size: number | null
}

/* ─── Low-level ADB Protocol ─── */

async function adbWrite(device: USBDevice, message: string): Promise<void> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  await device.transferOut(1, data)
}

async function adbRead(device: USBDevice): Promise<string> {
  const result = await device.transferIn(1, 65536)
  if (!result.data) return ''
  return new TextDecoder().decode(result.data)
}

async function adbCommand(device: USBDevice, command: string): Promise<{ status: string; payload: string }> {
  const encoder = new TextEncoder()
  const cmdBytes = encoder.encode(command)
  const lenHex = cmdBytes.length.toString(16).padStart(4, '0')

  await device.transferOut(1, encoder.encode(`${lenHex}${command}`))

  // Read status (4 bytes: OKAY or FAIL)
  const statusBytes = await device.transferIn(1, 4)
  if (!statusBytes.data) return { status: 'FAIL', payload: '' }
  const status = new TextDecoder().decode(statusBytes.data)

  // Read length (4 bytes hex)
  const lenBytes = await device.transferIn(1, 4)
  if (!lenBytes.data) return { status, payload: '' }
  const lenHexStr = new TextDecoder().decode(lenBytes.data)
  const dataLen = parseInt(lenHexStr, 16)

  if (isNaN(dataLen) || dataLen === 0) return { status, payload: '' }

  // Read payload
  const payloadBytes = await device.transferIn(1, dataLen)
  const payload = payloadBytes.data ? new TextDecoder().decode(payloadBytes.data) : ''

  return { status, payload }
}

/* ─── High-level ADB Operations ─── */

export async function connectAdbDevice(device: USBDevice): Promise<AdbDevice> {
  await device.open()

  if (!device.configuration) {
    await device.selectConfiguration(1)
  }

  // Find ADB interface (class 0xFF, subclass 0x42, protocol 0x01)
  const adbInterface = device.configuration?.interfaces.find(
    (iface) =>
      iface.alternate.interfaceClass === 0xff &&
      iface.alternate.interfaceSubclass === 0x42 &&
      iface.alternate.interfaceProtocol === 0x01,
  )

  if (!adbInterface) {
    throw new Error('ADB interface not found. Enable USB Debugging on your Android device.')
  }

  await device.claimInterface(adbInterface.interfaceNumber)

  // Send version check
  const versionResult = await adbCommand(device, 'host:version')
  if (versionResult.status !== ADB_RESPONSE_OK) {
    throw new Error('ADB daemon not responding. Ensure USB Debugging is enabled.')
  }

  // Get device serial
  const serial = device.serialNumber || `adb-${device.vendorId}-${device.productId}`
  const name = device.productName || device.manufacturerName || 'Android Device'

  return { device, serial, name }
}

export async function listInstalledApps(adbDevice: AdbDevice): Promise<InstalledApp[]> {
  const { device } = adbDevice

  // Switch to device transport
  const transportResult = await adbCommand(device, `host:transport:${adbDevice.serial}`)
  if (transportResult.status !== ADB_RESPONSE_OK) {
    throw new Error('Failed to connect to device transport')
  }

  // List third-party packages
  const result = await adbCommand(device, 'shell:pm list packages -3')
  if (result.status !== ADB_RESPONSE_OK) {
    throw new Error('Failed to list packages. Ensure USB Debugging authorization is granted.')
  }

  const packages = result.payload
    .split('\n')
    .map((line) => line.replace('package:', '').trim())
    .filter((pkg) => pkg.length > 0)

  // Get APK paths for each package
  const apps: InstalledApp[] = []
  for (const pkg of packages.slice(0, 50)) { // Limit to 50 to avoid timeout
    try {
      const pathResult = await adbCommand(device, `shell:pm path ${pkg}`)
      if (pathResult.status === ADB_RESPONSE_OK) {
        const path = pathResult.payload.replace('package:', '').trim().split('\n')[0]
        apps.push({ packageName: pkg, apkPath: path, size: null })
      } else {
        apps.push({ packageName: pkg, apkPath: null, size: null })
      }
    } catch {
      apps.push({ packageName: pkg, apkPath: null, size: null })
    }
  }

  return apps
}

export async function pullApkFromDevice(adbDevice: AdbDevice, apkPath: string): Promise<File> {
  const { device } = adbDevice

  // Switch to device transport
  await adbCommand(device, `host:transport:${adbDevice.serial}`)

  // Initiate sync
  const syncResult = await adbCommand(device, `sync:`)
  if (syncResult.status !== ADB_RESPONSE_OK) {
    throw new Error('Failed to initiate file sync')
  }

  // Send RECV command
  const encoder = new TextEncoder()
  const recvCmd = encoder.encode(`RECV${apkPath.length.toString(16).padStart(4, '0')}${apkPath}`)
  await device.transferOut(1, recvCmd)

  // Read response
  const respBytes = await device.transferIn(1, 4)
  if (!respBytes.data) throw new Error('No response from device')
  const resp = new TextDecoder().decode(respBytes.data)

  if (resp !== ADB_RESPONSE_OK) {
    throw new Error(`Failed to pull APK: ${resp}`)
  }

  // Read file size (4 bytes LE)
  const sizeBytes = await device.transferIn(1, 4)
  if (!sizeBytes.data) throw new Error('No file size received')
  const sizeView = new DataView(sizeBytes.data.buffer)
  const fileSize = sizeView.getUint32(0, true) // little-endian

  // Read file data in chunks
  const chunks: ArrayBuffer[] = []
  let totalRead = 0
  while (totalRead < fileSize) {
    const chunkSize = Math.min(65536, fileSize - totalRead)
    const chunkBytes = await device.transferIn(1, chunkSize)
    if (!chunkBytes.data) break
    chunks.push(chunkBytes.data.buffer as ArrayBuffer)
    totalRead += chunkBytes.data.byteLength
  }

  // Combine chunks into a single ArrayBuffer
  const combined = new Uint8Array(fileSize)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }

  // Extract filename from path
  const fileName = apkPath.split('/').pop() || 'app.apk'

  return new File([combined], fileName, { type: 'application/vnd.android.package-archive' })
}

export async function disconnectAdbDevice(adbDevice: AdbDevice): Promise<void> {
  try {
    await adbDevice.device.close()
  } catch {
    // Device may already be disconnected
  }
}

export function isWebUSBSupported(): boolean {
  return 'usb' in navigator
}

export async function requestAdbDevice(): Promise<USBDevice | null> {
  if (!isWebUSBSupported()) return null

  const usb = navigator.usb
  if (!usb) return null
  try {
    return await usb.requestDevice({
      filters: [
        { classCode: 0xff, subclassCode: 0x42, protocolCode: 0x01 }, // ADB
        { vendorId: 0x18d1 }, // Google
        { vendorId: 0x0525 }, // Samsung
        { vendorId: 0x2717 }, // Xiaomi
        { vendorId: 0x0bb4 }, // HTC
        { vendorId: 0x04e8 }, // Samsung (alt)
      ],
    })
  } catch {
    return null
  }
}
