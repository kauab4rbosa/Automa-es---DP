export const BRL = (v: number | string): string =>
  'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const PCT = (v: number | string): string =>
  (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'

export const numVal = (val: string | number): number =>
  Number(String(val || '0').replace(',', '.')) || 0

export const round2 = (n: number): number =>
  Math.round(n * 100 + Number.EPSILON) / 100

export const formatCurrency = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatPct = (v: number): string =>
  (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
