/* ─── WebUSB ─── */
interface USBDevice {
  usbVersionMajor: number
  usbVersionMinor: number
  usbVersionSubminor: number
  deviceClass: number
  deviceSubclass: number
  deviceProtocol: number
  vendorId: number
  productId: number
  deviceVersionMajor: number
  deviceVersionMinor: number
  deviceVersionSubminor: number
  manufacturerName?: string
  productName?: string
  serialNumber?: string
  configuration?: USBConfiguration
  configurations: USBConfiguration[]
  opened: boolean
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  selectAlternateInterface(interfaceNumber: number, alternateSettingNumber: number): Promise<void>
  controlTransferIn(requestType: string, request: number, value: number, index: number, length: number): Promise<USBInTransferResult>
  controlTransferOut(requestType: string, request: number, value: number, index: number, data?: BufferSource): Promise<USBOutTransferResult>
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>
  isochronousTransferIn(endpointNumber: number, packetLengths: number[]): Promise<USBIsochronousInTransferResult>
  isochronousTransferOut(endpointNumber: number, data: BufferSource, packetLengths: number[]): Promise<USBIsochronousOutTransferResult>
  reset(): Promise<void>
}

interface USBConfiguration {
  configurationValue: number
  configurationName?: string
  interfaces: USBInterface[]
}

interface USBInterface {
  interfaceNumber: number
  alternate: USBAlternateInterface
  alternates: USBAlternateInterface[]
}

interface USBAlternateInterface {
  alternateSetting: number
  interfaceClass: number
  interfaceSubclass: number
  interfaceProtocol: number
  interfaceName?: string
  endpoints: USBEndpoint[]
}

interface USBEndpoint {
  endpointNumber: number
  direction: string
  type: string
  packetSize: number
}

interface USBInTransferResult {
  data?: DataView
  status: string
}

interface USBOutTransferResult {
  bytesWritten: number
  status: string
}

interface USBIsochronousInTransferResult {
  data?: DataView
  packets: USBIsochronousInTransferPacket[]
}

interface USBIsochronousInTransferPacket {
  data?: DataView
  status: string
}

interface USBIsochronousOutTransferResult {
  packets: USBIsochronousOutTransferPacket[]
}

interface USBIsochronousOutTransferPacket {
  bytesWritten: number
  status: string
}

interface USBConnectionEvent extends Event {
  device: USBDevice
}

interface USB {
  getDevices(): Promise<USBDevice[]>
  requestDevice(options?: { filters?: USBDeviceFilter[] }): Promise<USBDevice>
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

interface USBDeviceFilter {
  vendorId?: number
  productId?: number
  classCode?: number
  subclassCode?: number
  protocolCode?: number
  serialNumber?: string
}

/* ─── Web Serial ─── */
interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  readonly opened: boolean
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string; bufferSize?: number; flowControl?: string }): Promise<void>
  close(): Promise<void>
  setSignals(signals: { dtr?: boolean; rts?: boolean }): Promise<void>
  getSignals(): Promise<{ dcd: boolean; cts: boolean; dsr: boolean; ring: boolean }>
  getInfo(): SerialPortInfo
}

interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
  serialNumber?: string
  manufacturerName?: string
  productName?: string
}

interface Serial {
  getPorts(): Promise<SerialPort[]>
  requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPort>
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

interface SerialConnectionEvent extends Event {
  port: SerialPort
}

/* ─── Web Bluetooth ─── */
interface BluetoothDevice {
  id: string
  name: string | null
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  device: BluetoothDevice
  uuid: string
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic {
  service: BluetoothRemoteGATTService
  uuid: string
  readValue(): Promise<DataView>
  writeValue(value: BufferSource): Promise<void>
}

interface Bluetooth {
  requestDevice(options?: {
    filters?: Array<{ name?: string; namePrefix?: string; services?: string[] }>
    optionalServices?: string[]
    acceptAllDevices?: boolean
  }): Promise<BluetoothDevice>
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

/* ─── Navigator extensions ─── */
interface Navigator {
  usb?: USB
  serial?: Serial
  bluetooth?: Bluetooth
  storage?: StorageManager
}

/* ─── StorageManager ─── */
interface StorageManager {
  persist(): Promise<boolean>
  persisted(): Promise<boolean>
  estimate(): Promise<StorageEstimate>
  getDirectory(): FileSystemDirectoryHandle
}

interface StorageEstimate {
  usage?: number
  quota?: number
}

interface FileSystemDirectoryHandle {
  getFileHandle(name: string): Promise<FileSystemFileHandle>
  getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle>
  removeEntry(name: string): Promise<void>
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>
}
