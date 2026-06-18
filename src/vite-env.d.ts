/// <reference types="vite/client" />

declare module 'xlsx-js-style' {
  const XLSX: any
  export = XLSX
}

declare module 'fflate' {
  export function zipSync(files: Record<string, Uint8Array>, opts?: any): Uint8Array
  export function strToU8(str: string): Uint8Array
  export function strFromU8(data: Uint8Array, latin1?: boolean): string
}
