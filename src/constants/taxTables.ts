// ═══════════════════════════════════════════════
// TABELAS TRIBUTÁRIAS — Fonte única de verdade
// Base: 2026 | LC 150/2015, Lei 8.212/91, Lei 15.270/2025
// ═══════════════════════════════════════════════

// ─── INSS Segurado (Progressivo) ───
export const TETO_INSS = 8_475.55

export interface FaixaINSS {
  limite: number
  aliq: number
}

export const FAIXAS_INSS: FaixaINSS[] = [
  { limite: 1_621.00, aliq: 0.075 },
  { limite: 2_902.84, aliq: 0.09  },
  { limite: 4_354.27, aliq: 0.12  },
  { limite: 8_475.55, aliq: 0.14  },
]

// ─── IRRF (Tabela progressiva mensal) ───
export interface FaixaIRRF {
  limite: number
  aliq: number
  deduz: number
}

export const FAIXAS_IRRF: FaixaIRRF[] = [
  { limite: 2_428.80,  aliq: 0,     deduz: 0      },
  { limite: 2_826.65,  aliq: 0.075, deduz: 182.16 },
  { limite: 3_751.05,  aliq: 0.15,  deduz: 394.16 },
  { limite: 4_664.68,  aliq: 0.225, deduz: 675.49 },
  { limite: Infinity,  aliq: 0.275, deduz: 908.73 },
]

// ─── Deduções IRRF ───
export const DEDUCAO_DEPENDENTE   = 189.59
export const DESCONTO_SIMPLIFICADO = 607.20  // 25% de R$2.428,80 (1ª faixa)

// ─── Redutor Lei 15.270/2025 ───
export const REDUTOR_ISENCAO = 5_000.00   // isento até aqui
export const REDUTOR_TETO    = 7_350.00   // redução gradual até aqui
export const REDUTOR_MAX     = 312.89     // redução máxima (na 4ª faixa)

// ─── Funções de cálculo (reutilizáveis) ───

/** INSS progressivo do segurado (empregado) */
export function calcInssSegurado(base: number): number {
  const b = Math.min(base, TETO_INSS)
  let imposto = 0
  let anterior = 0
  for (const f of FAIXAS_INSS) {
    if (b > anterior) {
      imposto += (Math.min(b, f.limite) - anterior) * f.aliq
      anterior = f.limite
    } else break
  }
  return imposto
}

/** Aplica tabela progressiva IRRF a uma base de cálculo */
export function irrfTabela(base: number): number {
  if (base <= 0) return 0
  for (const f of FAIXAS_IRRF) {
    if (base <= f.limite) return Math.max(0, base * f.aliq - f.deduz)
  }
  return 0
}

export interface IrrfResult {
  valor: number
  modelo: 'Simplificado' | 'Completo'
  baseCompleto: number
  baseSimplificado: number
  baseUsada: number
  semRedutor: number
}

/** IRRF — escolhe o modelo mais vantajoso + aplica redutor Lei 15.270/2025 */
export function calcIrrf(brutoMensal: number, inssSeg: number, dependentes: number): IrrfResult {
  const baseCompleto = Math.max(0, brutoMensal - inssSeg - dependentes * DEDUCAO_DEPENDENTE)
  const baseSimplificado = Math.max(0, brutoMensal - DESCONTO_SIMPLIFICADO)

  const impCompleto = irrfTabela(baseCompleto)
  const impSimplificado = irrfTabela(baseSimplificado)

  let imposto: number
  let modelo: 'Simplificado' | 'Completo'
  let baseUsada: number

  if (impSimplificado <= impCompleto) {
    imposto = impSimplificado; modelo = 'Simplificado'; baseUsada = baseSimplificado
  } else {
    imposto = impCompleto; modelo = 'Completo'; baseUsada = baseCompleto
  }
  const semRedutor = imposto

  if (brutoMensal <= REDUTOR_ISENCAO) {
    imposto = 0
  } else if (brutoMensal <= REDUTOR_TETO) {
    const redutor = REDUTOR_MAX * (REDUTOR_TETO - brutoMensal) / (REDUTOR_TETO - REDUTOR_ISENCAO)
    imposto = Math.max(0, imposto - redutor)
  }

  return { valor: imposto, modelo, baseCompleto, baseSimplificado, baseUsada, semRedutor }
}

/** INSS com dedução fixa (equivalente ao progressivo — usado na Calculadora IRRF standalone) */
export interface InssResult {
  aliquota: number
  deducao: number
  valor: number
  isTeto: boolean
}

export function calcINSS(salario: number, isProlabore: boolean): InssResult {
  const tetoINSS = TETO_INSS
  if (isProlabore) {
    const baseCalculo = Math.min(salario, tetoINSS)
    return { aliquota: 0.11, deducao: 0, valor: Math.round(baseCalculo * 0.11 * 100) / 100, isTeto: salario > tetoINSS }
  }
  // Dedução fixa equivalente ao cálculo progressivo
  const faixasComDed = [
    { ate: 1_621.00, aliquota: 0.075, deducao: 0.00    },
    { ate: 2_902.84, aliquota: 0.090, deducao: 24.32   },
    { ate: 4_354.27, aliquota: 0.120, deducao: 111.42  },
    { ate: 8_475.55, aliquota: 0.140, deducao: 198.50  },
  ]
  for (const faixa of faixasComDed) {
    if (salario <= faixa.ate) {
      const valor = Math.max(0, Math.round((salario * faixa.aliquota - faixa.deducao) * 100) / 100)
      return { aliquota: faixa.aliquota, deducao: faixa.deducao, valor, isTeto: false }
    }
  }
  const ultimo = faixasComDed[faixasComDed.length - 1]
  const valorMaximo = Math.round((tetoINSS * ultimo.aliquota - ultimo.deducao) * 100) / 100
  return { aliquota: ultimo.aliquota, deducao: ultimo.deducao, valor: valorMaximo, isTeto: true }
}

/** Redutor Lei 15.270/2025 */
export interface RedutorResult {
  valor: number
  formula: string
}

export function calcReducao15270(rendimentoBruto: number, irrfCalculado: number): RedutorResult {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (rendimentoBruto <= REDUTOR_ISENCAO) {
    return { valor: irrfCalculado, formula: `Rendimentos até ${fmt(REDUTOR_ISENCAO)} são isentos.` }
  } else if (rendimentoBruto <= REDUTOR_TETO) {
    const reducaoCalc = Math.max(0, Math.round((978.62 - 0.133145 * rendimentoBruto) * 100) / 100)
    const reducaoAplicada = Math.min(reducaoCalc, irrfCalculado)
    return {
      valor: reducaoAplicada,
      formula: `R$ 978,62 − (0,133145 × ${fmt(rendimentoBruto)}) = ${fmt(reducaoCalc)}`
    }
  }
  return { valor: 0, formula: `Sem redução (Rendimentos > ${fmt(REDUTOR_TETO)})` }
}
