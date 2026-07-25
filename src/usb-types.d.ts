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
  addEventListener(type: 'connect', listener: (event: USBConnectionEvent) => void): void
  addEventListener(type: 'disconnect', listener: (event: USBConnectionEvent) => void): void
  removeEventListener(type: 'connect', listener: (event: USBConnectionEvent) => void): void
  removeEventListener(type: 'disconnect', listener: (event: USBConnectionEvent) => void): void
}

interface USBDeviceFilter {
  vendorId?: number
  productId?: number
  classCode?: number
  subclassCode?: number
  protocolCode?: number
  serialNumber?: string
}

interface Navigator {
  usb?: USB
}
