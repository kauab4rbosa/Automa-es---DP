import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const FATOR_NOTURNO = 60 / 52.5
const NOTURNO_INI = 22 * 60   // 22:00 em minutos
const NOTURNO_FIM = 5 * 60    // 05:00 em minutos
const MULT_MENSAL = 5          // semanas no mês para fins de cálculo mensal

interface DiaJornada {
  id: number
  nome: string
  entrada: string
  iniInt: string
  fimInt: string
  saida: string
}

interface DiaResult {
  totalMin: number
  normaisMin: number
  noturnoFictoMin: number
  totalComFicta: number
  intervaloMin: number
}

const DIAS_NOMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

function createDias(): DiaJornada[] {
  return DIAS_NOMES.map((nome, i) => ({
    id: i,
    nome,
    entrada: '',
    iniInt: '',
    fimInt: '',
    saida: '',
  }))
}

function parseTime(str: string): number | null {
  if (!str || !str.includes(':')) return null
  const [h, m] = str.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function fmtHHMM(min: number): string {
  if (min < 0) {
    const abs = Math.abs(min)
    return '-' + String(Math.floor(abs / 60)).padStart(2, '0') + ':' + String(abs % 60).padStart(2, '0')
  }
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')
}

function fmtDecimal(min: number): string {
  return (min / 60).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'h'
}

function calcularDia(entrada: string, iniInt: string, fimInt: string, saida: string): DiaResult | null {
  const e = parseTime(entrada)
  const s = parseTime(saida)
  if (e === null || s === null) return null

  let totalBruto = s - e
  if (totalBruto < 0) totalBruto += 24 * 60

  const ii = parseTime(iniInt)
  const fi = parseTime(fimInt)
  let intervaloMin = 0
  if (ii !== null && fi !== null) {
    intervaloMin = fi - ii
    if (intervaloMin < 0) intervaloMin += 24 * 60
  }

  const totalMin = totalBruto - intervaloMin

  // Cálculo de horas noturnas (22h às 5h com ficta)
  let noturnoMin = 0

  // Períodos do turno (antes do intervalo e depois)
  const periodos: [number, number][] = []

  if (ii !== null && fi !== null && intervaloMin > 0) {
    periodos.push([e, ii])
    periodos.push([fi, s])
  } else {
    periodos.push([e, s])
  }

  for (const [inicio, fim] of periodos) {
    // Noturno: 22:00 até 05:00 (próximo dia)
    // Convertemos para normalizar: trabalho que cruza meia-noite
    const noturnoIni = NOTURNO_INI  // 1320 min = 22h
    const noturnoFim = NOTURNO_FIM + 24 * 60  // 1740 min = 29h (5h do dia seguinte)

    // Normaliza início e fim para poder comparar
    let iNorm = inicio
    let fNorm = fim
    if (fNorm < iNorm) fNorm += 24 * 60

    // Período noturno do mesmo dia: [1320, 1439]
    const overlapA = Math.min(fNorm, 24 * 60) - Math.max(iNorm, noturnoIni)
    if (overlapA > 0) noturnoMin += overlapA

    // Período noturno do dia seguinte: [0, 300] (00h às 5h)
    const overlapB = Math.min(fNorm, noturnoFim) - Math.max(iNorm, 24 * 60)
    if (overlapB > 0) noturnoMin += overlapB
  }

  // Horas noturnas com ficta: cada hora noturna real = 52,5 minutos de trabalho real
  // então 1 hora trabalhada à noite = FATOR_NOTURNO horas fictas
  const noturnoFictoMin = Math.round(noturnoMin * FATOR_NOTURNO - noturnoMin)
  const normaisMin = totalMin - noturnoMin
  const totalComFicta = totalMin + noturnoFictoMin

  return { totalMin, normaisMin, noturnoFictoMin, totalComFicta, intervaloMin }
}

export default function CalculadoraJornada() {
  const navigate = useNavigate()
  const [dias, setDias] = useState<DiaJornada[]>(createDias())

  function updateDia(id: number, field: keyof DiaJornada, value: string) {
    setDias(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  function limparDia(id: number) {
    setDias(prev => prev.map(d => d.id === id ? { ...d, entrada: '', iniInt: '', fimInt: '', saida: '' } : d))
  }

  function replicarSegunda() {
    const seg = dias[0]
    setDias(prev => prev.map((d, i) => i === 0 ? d : { ...d, entrada: seg.entrada, iniInt: seg.iniInt, fimInt: seg.fimInt, saida: seg.saida }))
  }

  function limparTudo() {
    setDias(createDias())
  }

  const resultados = dias.map(d => calcularDia(d.entrada, d.iniInt, d.fimInt, d.saida))

  const totalSemanalNormais = resultados.reduce((acc, r) => acc + (r ? r.normaisMin : 0), 0)
  const totalSemanalNoturno = resultados.reduce((acc, r) => acc + (r ? r.noturnoFictoMin : 0), 0)
  const totalSemanalTotal = resultados.reduce((acc, r) => acc + (r ? r.totalComFicta : 0), 0)
  const totalSemanalBruto = resultados.reduce((acc, r) => acc + (r ? r.totalMin : 0), 0)

  const totalMensalNormais = totalSemanalNormais * MULT_MENSAL
  const totalMensalNoturno = totalSemanalNoturno * MULT_MENSAL
  const totalMensalTotal = totalSemanalTotal * MULT_MENSAL

  return (
    <div className="page">
      <div className="card">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Painel DP
        </button>

        <h1 className="title">Calculadora de Jornada</h1>

        <div className="top-actions">
          <button className="btn-replicar" onClick={replicarSegunda}>
            ⊞ Replicar Segunda para todos
          </button>
          <button className="btn-limpar" onClick={limparTudo}>
            ✕ Limpar tudo
          </button>
          <span className="badge badge-purple">CLT — Adicional Noturno</span>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-label">Total Semanal (sem ficta)</div>
            <div className="stat-value">{fmtHHMM(totalSemanalBruto)}</div>
          </div>
          <div className="stat-box blue">
            <div className="stat-label">Normais (semanais)</div>
            <div className="stat-value">{fmtHHMM(totalSemanalNormais)}</div>
          </div>
          <div className="stat-box orange">
            <div className="stat-label">Ficta Noturna (semanais)</div>
            <div className="stat-value">{fmtHHMM(totalSemanalNoturno)}</div>
          </div>
          <div className="stat-box green">
            <div className="stat-label">Total c/ Ficta (semanais)</div>
            <div className="stat-value">{fmtHHMM(totalSemanalTotal)}</div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="jornada-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Entrada</th>
                <th>Início Intervalo</th>
                <th>Fim Intervalo</th>
                <th>Saída</th>
                <th>Normais</th>
                <th>Noturnas (ficta)</th>
                <th>Total c/ Ficta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dias.map((dia, i) => {
                const r = resultados[i]
                return (
                  <tr key={dia.id}>
                    <td style={{ minWidth: 120 }}>{dia.nome}</td>
                    <td>
                      <input
                        type="time"
                        value={dia.entrada}
                        onChange={e => updateDia(dia.id, 'entrada', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={dia.iniInt}
                        onChange={e => updateDia(dia.id, 'iniInt', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={dia.fimInt}
                        onChange={e => updateDia(dia.id, 'fimInt', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={dia.saida}
                        onChange={e => updateDia(dia.id, 'saida', e.target.value)}
                      />
                    </td>
                    <td className="result-cell" style={{ color: r ? 'var(--blue)' : 'var(--ink-muted)' }}>
                      {r ? fmtHHMM(r.normaisMin) : '—'}
                    </td>
                    <td className="result-cell" style={{ color: r && r.noturnoFictoMin > 0 ? 'var(--orange)' : 'var(--ink-muted)' }}>
                      {r ? (r.noturnoFictoMin > 0 ? '+' + fmtHHMM(r.noturnoFictoMin) : '—') : '—'}
                    </td>
                    <td className="result-cell" style={{ color: r ? 'var(--green)' : 'var(--ink-muted)', fontWeight: 700 }}>
                      {r ? fmtHHMM(r.totalComFicta) : '—'}
                    </td>
                    <td>
                      <button className="btn-row-clear" onClick={() => limparDia(dia.id)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total Semanal</td>
                <td>{fmtHHMM(totalSemanalNormais)}</td>
                <td>{totalSemanalNoturno > 0 ? '+' + fmtHHMM(totalSemanalNoturno) : '—'}</td>
                <td>{fmtHHMM(totalSemanalTotal)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={5}>Total Mensal (×{MULT_MENSAL} semanas)</td>
                <td>{fmtHHMM(totalMensalNormais)} ({fmtDecimal(totalMensalNormais)})</td>
                <td>{totalMensalNoturno > 0 ? '+' + fmtHHMM(totalMensalNoturno) : '—'}</td>
                <td>{fmtHHMM(totalMensalTotal)} ({fmtDecimal(totalMensalTotal)})</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="info-irrf" style={{ marginTop: 24 }}>
          <strong>ℹ️ Horas Noturnas (CLT art. 73):</strong> Período noturno: 22h às 5h. Adicional de 20% — cada hora noturna real equivale a 52,5 minutos trabalhados (1h ficta = 60 min / 52,5 min × hora real). A coluna "Noturnas (ficta)" mostra o acréscimo em minutos. Total c/ Ficta = horas normais + acréscimo noturno. Mensal calculado em {MULT_MENSAL}× a semana (média CLT).
        </div>
      </div>
    </div>
  )
}
