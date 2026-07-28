import { computeSHA256, analyzeFileForThreats } from './scanner'
import { supabase } from './supabase'

const MSC_CLASS = 0x08
const MSC_SUBCLASS_SCSI = 0x06
const MSC_PROTOCOL_BOT = 0x50

const DIR_IN = 'in'
const DIR_OUT = 'out'

interface BotEndpoint {
  inEndpoint: number
  outEndpoint: number
}

interface Cbw {
  dCBWSignature: Uint32Array
  dCBWTag: Uint32Array
  dCBWDataTransferLength: Uint32Array
  bmCBWFlags: Uint8Array
  bCBWLUN: Uint8Array
  bCBWCBLength: Uint8Array
  CBWCB: Uint8Array
}

interface ScsiInquiryResponse {
  peripheralDeviceType: number
  removable: boolean
  vendorId: string
  productId: string
  productRevisionLevel: string
}

interface ScsiReadCapacityResponse {
  lastLogicalBlockAddress: number
  blockLength: number
}

export interface MassStorageFile {
  name: string
  path: string
  size: number
  data: ArrayBuffer | null
}

const CBW_SIGNATURE = 0x43425355
const CSW_SIGNATURE = 0x53425355

function findBotEndpoints(device: USBDevice): BotEndpoint | null {
  const config = device.configuration
  if (!config) return null

  for (const iface of config.interfaces) {
    const alt = iface.alternate
    if (alt.interfaceClass === MSC_CLASS &&
        alt.interfaceSubclass === MSC_SUBCLASS_SCSI &&
        alt.interfaceProtocol === MSC_PROTOCOL_BOT) {
      let inEp = 0
      let outEp = 0
      for (const ep of alt.endpoints) {
        if (ep.direction === DIR_IN && ep.type === 'bulk') inEp = ep.endpointNumber
        if (ep.direction === DIR_OUT && ep.type === 'bulk') outEp = ep.endpointNumber
      }
      if (inEp && outEp) return { inEndpoint: inEp, outEndpoint: outEp }
    }
  }
  return null
}

function buildCbw(tag: number, dataLength: number, flags: number, lun: number, cb: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(31)
  const view = new DataView(buf)
  view.setUint32(0, CBW_SIGNATURE, true)
  view.setUint32(4, tag, true)
  view.setUint32(8, dataLength, true)
  view.setUint8(12, flags)
  view.setUint8(13, lun)
  view.setUint8(14, cb.length)
  for (let i = 0; i < cb.length; i++) view.setUint8(15 + i, cb[i])
  return buf
}

async function sendCbw(device: USBDevice, epOut: number, cbw: ArrayBuffer): Promise<void> {
  const result = await device.transferOut(epOut, cbw)
  if (result.status !== 'ok') throw new Error('CBW transfer failed')
}

async function readData(device: USBDevice, epIn: number, length: number): Promise<ArrayBuffer> {
  const chunks: ArrayBuffer[] = []
  let remaining = length
  while (remaining > 0) {
    const toRead = Math.min(remaining, 65536)
    const result = await device.transferIn(epIn, toRead)
    if (!result.data || result.status !== 'ok') throw new Error('Data transfer failed')
    const buf = result.data.buffer as ArrayBuffer
    const chunk = buf.slice(result.data.byteOffset, result.data.byteOffset + result.data.byteLength)
    chunks.push(chunk)
    remaining -= result.data.byteLength
  }
  if (chunks.length === 1) return chunks[0]
  const combined = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }
  return combined.buffer as ArrayBuffer
}

async function readCsw(device: USBDevice, epIn: number): Promise<{ status: number; tag: number }> {
  const result = await device.transferIn(epIn, 13)
  if (!result.data || result.status !== 'ok') throw new Error('CSW transfer failed')
  const view = new DataView(result.data.buffer, result.data.byteOffset, result.data.byteLength)
  const signature = view.getUint32(0, true)
  if (signature !== CSW_SIGNATURE) throw new Error(`Invalid CSW signature: 0x${signature.toString(16)}`)
  return { status: view.getUint8(12), tag: view.getUint32(4, true) }
}

async function botTransfer(device: USBDevice, eps: BotEndpoint, tag: number, cb: Uint8Array, dataLength: number, direction: 'in' | 'out', data?: ArrayBuffer): Promise<{ data?: ArrayBuffer; status: number }> {
  const flags = direction === 'in' ? 0x80 : 0
  const cbw = buildCbw(tag, dataLength, flags, 0, cb)
  await sendCbw(device, eps.outEndpoint, cbw)

  let receivedData: ArrayBuffer | undefined
  if (direction === 'in' && dataLength > 0) {
    receivedData = await readData(device, eps.inEndpoint, dataLength)
  } else if (direction === 'out' && data && dataLength > 0) {
    await device.transferOut(eps.outEndpoint, data)
  }

  const csw = await readCsw(device, eps.inEndpoint)
  return { data: receivedData, status: csw.status }
}

export function isMassStorageDevice(device: USBDevice): boolean {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      if (iface.alternate.interfaceClass === MSC_CLASS &&
          iface.alternate.interfaceSubclass === MSC_SUBCLASS_SCSI &&
          iface.alternate.interfaceProtocol === MSC_PROTOCOL_BOT) {
        return true
      }
    }
  }
  return false
}

export async function openMassStorageDevice(device: USBDevice): Promise<void> {
  if (!device.opened) await device.open()
  if (!device.configuration) await device.selectConfiguration(1)

  const config = device.configuration
  if (!config) throw new Error('No configuration available')

  for (const iface of config.interfaces) {
    if (iface.alternate.interfaceClass === MSC_CLASS &&
        iface.alternate.interfaceSubclass === MSC_SUBCLASS_SCSI &&
        iface.alternate.interfaceProtocol === MSC_PROTOCOL_BOT) {
      await device.claimInterface(iface.interfaceNumber)
      return
    }
  }
  throw new Error('Mass storage interface not found')
}

export async function scsiInquiry(device: USBDevice, eps: BotEndpoint, tag: number): Promise<ScsiInquiryResponse> {
  const cdb = new Uint8Array(6)
  cdb[0] = 0x12
  cdb[4] = 36
  const result = await botTransfer(device, eps, tag, cdb, 36, 'in')
  if (!result.data) throw new Error('Inquiry failed')
  const view = new DataView(result.data)
  return {
    peripheralDeviceType: view.getUint8(0) & 0x1f,
    removable: !!(view.getUint8(1) & 0x80),
    vendorId: new TextDecoder().decode(result.data.slice(8, 16)).trim(),
    productId: new TextDecoder().decode(result.data.slice(16, 32)).trim(),
    productRevisionLevel: new TextDecoder().decode(result.data.slice(32, 36)).trim(),
  }
}

export async function scsiReadCapacity(device: USBDevice, eps: BotEndpoint, tag: number): Promise<ScsiReadCapacityResponse> {
  const cdb = new Uint8Array(10)
  cdb[0] = 0x25
  const result = await botTransfer(device, eps, tag, cdb, 8, 'in')
  if (!result.data) throw new Error('Read Capacity failed')
  const view = new DataView(result.data)
  return {
    lastLogicalBlockAddress: view.getUint32(0, false),
    blockLength: view.getUint32(4, false),
  }
}

export async function scsiReadSectors(device: USBDevice, eps: BotEndpoint, tag: number, lba: number, sectors: number, blockSize: number): Promise<ArrayBuffer> {
  const cdb = new Uint8Array(10)
  cdb[0] = 0x28
  cdb[2] = (lba >> 24) & 0xff
  cdb[3] = (lba >> 16) & 0xff
  cdb[4] = (lba >> 8) & 0xff
  cdb[5] = lba & 0xff
  cdb[7] = (sectors >> 8) & 0xff
  cdb[8] = sectors & 0xff
  const result = await botTransfer(device, eps, tag, cdb, sectors * blockSize, 'in')
  if (!result.data) throw new Error('Read sectors failed')
  return result.data
}

export async function scsiTestUnitReady(device: USBDevice, eps: BotEndpoint, tag: number): Promise<boolean> {
  const cdb = new Uint8Array(6)
  cdb[0] = 0x00
  try {
    const result = await botTransfer(device, eps, tag, cdb, 0, 'in')
    return result.status === 0
  } catch { return false }
}

export async function scsiRequestSense(device: USBDevice, eps: BotEndpoint, tag: number): Promise<Uint8Array | null> {
  const cdb = new Uint8Array(6)
  cdb[0] = 0x03
  cdb[4] = 18
  try {
    const result = await botTransfer(device, eps, tag, cdb, 18, 'in')
    return result.data ? new Uint8Array(result.data) : null
  } catch { return null }
}

interface Fat32BootSector {
  bytesPerSector: number
  sectorsPerCluster: number
  reservedSectors: number
  fatCount: number
  rootCluster: number
  sectorsPerFat: number
  totalSectors: number
  fatStartSector: number
  dataStartSector: number
  totalClusters: number
}

function parseFat32BootSector(sector: ArrayBuffer): Fat32BootSector {
  const view = new DataView(sector)
  const bytesPerSector = view.getUint16(11, true)
  const sectorsPerCluster = view.getUint8(13)
  const reservedSectors = view.getUint16(14, true)
  const fatCount = view.getUint8(16)

  const rootCluster = view.getUint32(44, true)
  const sectorsPerFat = view.getUint32(36, true)
  const totalSectors32 = view.getUint32(32, true)

  const totalSectors = totalSectors32 || view.getUint32(20, true)

  const fatStartSector = reservedSectors
  const dataStartSector = fatStartSector + fatCount * sectorsPerFat
  const dataSectors = totalSectors - dataStartSector
  const totalClusters = Math.floor(dataSectors / sectorsPerCluster)

  return { bytesPerSector, sectorsPerCluster, reservedSectors, fatCount, rootCluster, sectorsPerFat, totalSectors, fatStartSector, dataStartSector, totalClusters }
}

function clusterToLba(cluster: number, bpb: Fat32BootSector): number {
  return bpb.dataStartSector + (cluster - 2) * bpb.sectorsPerCluster
}

async function readCluster(device: USBDevice, eps: BotEndpoint, tag: number, cluster: number, bpb: Fat32BootSector): Promise<ArrayBuffer> {
  const lba = clusterToLba(cluster, bpb)
  const sectors = bpb.sectorsPerCluster
  return scsiReadSectors(device, eps, tag, lba, sectors, bpb.bytesPerSector)
}

async function readFatEntry(device: USBDevice, eps: BotEndpoint, tag: number, cluster: number, bpb: Fat32BootSector, fatCache: Map<number, Uint8Array>): Promise<number> {
  const fatSector = bpb.fatStartSector + Math.floor(cluster * 4 / bpb.bytesPerSector)
  let fatData = fatCache.get(fatSector)
  if (!fatData) {
    const sectorData = await scsiReadSectors(device, eps, tag, fatSector, 1, bpb.bytesPerSector)
    fatData = new Uint8Array(sectorData)
    fatCache.set(fatSector, fatData)
  }
  const offset = (cluster * 4) % bpb.bytesPerSector
  const entry = (fatData[offset] | (fatData[offset + 1] << 8) | (fatData[offset + 2] << 16) | (fatData[offset + 3] << 24)) & 0x0fffffff
  return entry
}

const ATTR_DIRECTORY = 0x10
const ATTR_LONG_NAME = 0x0f
const ATTR_VOLUME_ID = 0x08

const EOC_MARKER = 0x0ffffff8

async function traverseDirectory(device: USBDevice, eps: BotEndpoint, tag: number, cluster: number, bpb: Fat32BootSector, fatCache: Map<number, Uint8Array>, parentPath: string, files: MassStorageFile[], depth: number): Promise<void> {
  if (depth > 20) return

  let currentCluster = cluster
  const visited = new Set<number>()

  while (currentCluster >= 2 && currentCluster < EOC_MARKER && !visited.has(currentCluster)) {
    visited.add(currentCluster)
    const clusterData = await readCluster(device, eps, tag, currentCluster, bpb)
    const entries = Math.floor(clusterData.byteLength / 32)
    const longNameParts: string[] = []

    for (let i = 0; i < entries; i++) {
      const offset = i * 32
      const entry = new Uint8Array(clusterData, offset, 32)

      if (entry[0] === 0x00) break
      if (entry[0] === 0xe5) { longNameParts.length = 0; continue }

      const attrs = entry[11]

      if (attrs === ATTR_LONG_NAME) {
        const part = new Uint8Array(26)
        let nameStr = ''
        for (let j = 1; j < 11; j += 2) {
          if (entry[j] !== 0xff && entry[j] !== 0) nameStr += String.fromCharCode(entry[j])
        }
        for (let j = 14; j < 26; j += 2) {
          if (entry[j] !== 0xff && entry[j] !== 0) nameStr += String.fromCharCode(entry[j])
        }
        for (let j = 28; j < 32; j += 2) {
          if (entry[j] !== 0xff && entry[j] !== 0) nameStr += String.fromCharCode(entry[j])
        }
        longNameParts.unshift(nameStr)
        continue
      }

      const nameBytes = new Uint8Array(8)
      const extBytes = new Uint8Array(3)
      for (let j = 0; j < 8; j++) nameBytes[j] = entry[j]
      for (let j = 0; j < 3; j++) extBytes[j] = entry[j + 8]

      const shortName = Array.from(nameBytes).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '').join('').trim()
      const ext = Array.from(extBytes).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '').join('').trim()

      const longName = longNameParts.join('')
      longNameParts.length = 0

      const fileName = longName || (ext ? `${shortName}.${ext}` : shortName)
      if (!fileName || fileName === '.' || fileName === '..') continue

      const filePath = parentPath ? `${parentPath}/${fileName}` : fileName

      const entryClusterHigh = (entry[21] << 24) | (entry[20] << 16)
      const entryClusterLow = (entry[27] << 8) | entry[26]
      const entryCluster = entryClusterHigh | entryClusterLow
      const fileSize = (entry[31] << 24) | (entry[30] << 16) | (entry[29] << 8) | entry[28]

      if (attrs & ATTR_DIRECTORY) {
        if (entryCluster >= 2) {
          await traverseDirectory(device, eps, tag, entryCluster, bpb, fatCache, filePath, files, depth + 1)
        }
      } else if (!(attrs & ATTR_VOLUME_ID)) {
        files.push({ name: fileName, path: filePath, size: fileSize, data: null })
      }
    }

    const nextCluster = await readFatEntry(device, eps, tag, currentCluster, bpb, fatCache)
    if (nextCluster >= EOC_MARKER || nextCluster < 2) break
    currentCluster = nextCluster
  }
}

async function readFileData(device: USBDevice, eps: BotEndpoint, tag: number, startCluster: number, fileSize: number, bpb: Fat32BootSector, fatCache: Map<number, Uint8Array>): Promise<ArrayBuffer> {
  const data = new Uint8Array(fileSize)
  let offset = 0
  let cluster = startCluster
  const visited = new Set<number>()

  while (cluster >= 2 && cluster < EOC_MARKER && offset < fileSize && !visited.has(cluster)) {
    visited.add(cluster)
    const clusterData = await readCluster(device, eps, tag, cluster, bpb)
    const toCopy = Math.min(clusterData.byteLength, fileSize - offset)
    data.set(new Uint8Array(clusterData, 0, toCopy), offset)
    offset += toCopy

    if (offset >= fileSize) break
    const next = await readFatEntry(device, eps, tag, cluster, bpb, fatCache)
    if (next >= EOC_MARKER || next < 2) break
    cluster = next
  }

  return data.buffer as ArrayBuffer
}

export async function scanMassStorageDevice(
  device: USBDevice,
  onProgress: (current: number, total: number, fileName: string) => void,
  onThreat: (fileName: string, threatName: string, riskScore: number) => void,
  onComplete: (results: { clean: number; threats: number; total: number }) => void,
): Promise<void> {
  const eps = findBotEndpoints(device)
  if (!eps) throw new Error('BOT endpoints not found')

  let tag = 1
  function nextTag() { return tag++ }

  const inquiry = await scsiInquiry(device, eps, nextTag())
  const capacity = await scsiReadCapacity(device, eps, nextTag())

  const bpb = parseFat32BootSector(await scsiReadSectors(device, eps, nextTag(), 0, 1, capacity.blockLength))
  const fatCache = new Map<number, Uint8Array>()

  const files: MassStorageFile[] = []
  await traverseDirectory(device, eps, nextTag(), bpb.rootCluster, bpb, fatCache, '', files, 0)

  let cleanCount = 0
  let threatCount = 0
  const total = files.length

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress(i + 1, total, file.path)

    try {
      const clusterChain = await readFatEntry(device, eps, nextTag(), i === 0 ? bpb.rootCluster : 2, bpb, fatCache)
      let fileCluster = 0

      for (const dirFile of files.slice(0, i + 1)) {
        const dirEntry = await findFileCluster(device, eps, nextTag(), dirFile.path, bpb, fatCache)
        if (dirFile.path === file.path) {
          fileCluster = dirEntry
          break
        }
      }

      if (fileCluster > 0 && file.size > 0) {
        const fileData = await readFileData(device, eps, nextTag(), fileCluster, file.size, bpb, fatCache)
        const blob = new Blob([fileData])
        const f = new File([blob], file.name, { type: '' })

        const sha256 = await computeSHA256(f)
        const analysis = analyzeFileForThreats(f, sha256)

        if (analysis.riskScore >= 50) {
          threatCount++
          onThreat(file.path, analysis.threatName || 'Unknown', analysis.riskScore)
        } else {
          cleanCount++
        }
      } else {
        cleanCount++
      }
    } catch {
      cleanCount++
    }
  }

  onComplete({ clean: cleanCount, threats: threatCount, total })
}

async function findFileCluster(device: USBDevice, eps: BotEndpoint, tag: number, targetPath: string, bpb: Fat32BootSector, fatCache: Map<number, Uint8Array>): Promise<number> {
  const parts = targetPath.split('/')
  let currentCluster = bpb.rootCluster

  for (const part of parts) {
    if (!part) continue
    let found = false
    let cluster = currentCluster
    const visited = new Set<number>()

    while (cluster >= 2 && cluster < EOC_MARKER && !visited.has(cluster)) {
      visited.add(cluster)
      const clusterData = await readCluster(device, eps, tag, cluster, bpb)
      const entries = Math.floor(clusterData.byteLength / 32)

      for (let i = 0; i < entries; i++) {
        const offset = i * 32
        const entry = new Uint8Array(clusterData, offset, 32)
        if (entry[0] === 0x00) break
        if (entry[0] === 0xe5) continue

        const attrs = entry[11]
        if (attrs === ATTR_LONG_NAME || attrs === ATTR_VOLUME_ID) continue

        const nameBytes = new Uint8Array(8)
        const extBytes = new Uint8Array(3)
        for (let j = 0; j < 8; j++) nameBytes[j] = entry[j]
        for (let j = 0; j < 3; j++) extBytes[j] = entry[j + 8]

        const shortName = Array.from(nameBytes).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '').join('').trim()
        const ext = Array.from(extBytes).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '').join('').trim()
        const fileName = ext ? `${shortName}.${ext}` : shortName

        if (fileName.toLowerCase() === part.toLowerCase() || fileName.toLowerCase().replace(/\s/g, '') === part.toLowerCase().replace(/\s/g, '')) {
          const entryClusterHigh = (entry[21] << 24) | (entry[20] << 16)
          const entryClusterLow = (entry[27] << 8) | entry[26]
          currentCluster = entryClusterHigh | entryClusterLow
          found = true
          break
        }
      }

      if (found) break
      const next = await readFatEntry(device, eps, tag, cluster, bpb, fatCache)
      if (next >= EOC_MARKER || next < 2) break
      cluster = next
    }

    if (!found) return 0
  }

  return currentCluster
}

async function resetRecovery(device: USBDevice, eps: BotEndpoint): Promise<void> {
  try {
    const iface = device.configuration?.interfaces.find(i => i.alternate.interfaceClass === MSC_CLASS)
    if (iface) {
      await device.releaseInterface(iface.interfaceNumber)
      await device.claimInterface(iface.interfaceNumber)
    }
  } catch {}
}
