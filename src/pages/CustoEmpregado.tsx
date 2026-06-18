import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRL, PCT, numVal } from '../utils/currency'

type Regime = 'real_presumido' | 'simples' | 'autonomo'

interface RegimeConfig {
  label: string
  aliqInss: string
  aliqTerc: string
  aliqFgts: string
  aliqMulta: string
  gilratDireto: string
}

const REGIMES: Record<Regime, RegimeConfig> = {
  real_presumido: {
    label: 'Lucro Real / Presumido',
    aliqInss: '20.00',
    aliqTerc: '5.80',
    aliqFgts: '8.00',
    aliqMulta: '40.00',
    gilratDireto: '1.50',
  },
  simples: {
    label: 'Simples Nacional',
    aliqInss: '20.00',
    aliqTerc: '5.80',
    aliqFgts: '8.00',
    aliqMulta: '40.00',
    gilratDireto: '1.50',
  },
  autonomo: {
    label: 'Autônomo / Pró-labore',
    aliqInss: '20.00',
    aliqTerc: '0.00',
    aliqFgts: '0.00',
    aliqMulta: '0.00',
    gilratDireto: '0.00',
  },
}

export default function CustoEmpregado() {
  const navigate = useNavigate()

  const [regime, setRegime] = useState<Regime>('real_presumido')
  const [salMin] = useState('1621.00')
  const [salBase, setSalBase] = useState('')
  const [chkInsal, setChkInsal] = useState(false)
  const [insal, setInsal] = useState('10')
  const [chkPeric, setChkPeric] = useState(false)
  const [gilratDireto, setGilratDireto] = useState('1.50')
  const [aliqInss, setAliqInss] = useState('20.00')
  const [aliqTerc, setAliqTerc] = useState('5.80')
  const [aliqFgts, setAliqFgts] = useState('8.00')
  const [aliqMulta, setAliqMulta] = useState('40.00')
  const [vtTotal, setVtTotal] = useState('0')
  const [vtDesc, setVtDesc] = useState('6.00')
  const [vrTotal, setVrTotal] = useState('0')
  const [vrDesc, setVrDesc] = useState('0')
  const [planoSaude, setPlanoSaude] = useState('0')
  const [outros, setOutros] = useState('0')

  function handleRegimeChange(r: Regime) {
    setRegime(r)
    const cfg = REGIMES[r]
    setAliqInss(cfg.aliqInss)
    setAliqTerc(cfg.aliqTerc)
    setAliqFgts(cfg.aliqFgts)
    setAliqMulta(cfg.aliqMulta)
    setGilratDireto(cfg.gilratDireto)
  }

  function limpar() {
    setSalBase('')
    setChkInsal(false)
    setInsal('10')
    setChkPeric(false)
    setVtTotal('0')
    setVtDesc('6.00')
    setVrTotal('0')
    setVrDesc('0')
    setPlanoSaude('0')
    setOutros('0')
    handleRegimeChange('real_presumido')
  }

  // Calculations
  const salBaseN = numVal(salBase)
  const salMinN = numVal(salMin)

  const insalN = chkInsal ? salBaseN * (numVal(insal) / 100) : 0
  const pericN = chkPeric ? salBaseN * 0.30 : 0
  const bruto = salBaseN + insalN + pericN

  // Encargos diretos
  const cpp = bruto * (numVal(aliqInss) / 100)
  const gilrat = bruto * (numVal(gilratDireto) / 100)
  const terc = bruto * (numVal(aliqTerc) / 100)
  const fgts = bruto * (numVal(aliqFgts) / 100)
  const totalEncDiretos = cpp + gilrat + terc + fgts

  // Provisões
  const provFerias = bruto / 12
  const provDecimo = bruto / 12
  const baseProv = provFerias + provDecimo
  const aliqEncProv = numVal(aliqInss) + numVal(gilratDireto) + numVal(aliqTerc) + numVal(aliqFgts)
  const encProv = baseProv * (aliqEncProv / 100)
  const provMulta = fgts * (numVal(aliqMulta) / 100)
  const totalProvisoes = provFerias + provDecimo + encProv + provMulta

  // Custos variáveis (benefícios)
  const vtTotalN = numVal(vtTotal)
  const vtDescN = Math.min(vtTotalN, salBaseN * (numVal(vtDesc) / 100))
  const vtLiq = vtTotalN - vtDescN

  const vrTotalN = numVal(vrTotal)
  const vrDescN = Math.min(vrTotalN, salBaseN * (numVal(vrDesc) / 100))
  const vrLiq = vrTotalN - vrDescN

  const planoSaudeN = numVal(planoSaude)
  const outrosN = numVal(outros)

  const totalBeneficios = vtLiq + vrLiq + planoSaudeN + outrosN

  // Totais
  const custoTotalMensal = bruto + totalEncDiretos + totalProvisoes + totalBeneficios
  const custoSemProv = bruto + totalEncDiretos + totalBeneficios
  const encargoPct = bruto > 0 ? (totalEncDiretos / bruto) * 100 : 0
  const custoTotalPct = bruto > 0 ? (custoTotalMensal / bruto) * 100 : 0

  async function exportarExcel() {
    try {
      const XLSX = await import('xlsx-js-style')

      const rows: any[][] = [
        ['CUSTO DE EMPREGADO (CLT)'],
        ['Regime:', REGIMES[regime].label],
        [],
        ['REMUNERAÇÃO'],
        ['Salário Base', salBaseN],
        ['Insalubridade', insalN],
        ['Periculosidade', pericN],
        ['Salário Bruto', bruto],
        [],
        ['ENCARGOS PATRONAIS DIRETOS'],
        ['CPP/INSS Patronal (' + PCT(aliqInss) + ')', cpp],
        ['GILRAT (' + PCT(gilratDireto) + ')', gilrat],
        ['Sistema S / Terceiros (' + PCT(aliqTerc) + ')', terc],
        ['FGTS (' + PCT(aliqFgts) + ')', fgts],
        ['Total Encargos Diretos', totalEncDiretos],
        [],
        ['PROVISÕES'],
        ['1/12 Férias', provFerias],
        ['1/12 13º Salário', provDecimo],
        ['Encargos s/ Provisões (' + PCT(aliqEncProv) + ')', encProv],
        ['Provisão Multa FGTS', provMulta],
        ['Total Provisões', totalProvisoes],
        [],
        ['BENEFÍCIOS'],
        ['VT (custo empresa)', vtLiq],
        ['VR (custo empresa)', vrLiq],
        ['Plano de Saúde', planoSaudeN],
        ['Outros', outrosN],
        ['Total Benefícios', totalBeneficios],
        [],
        ['RESUMO'],
        ['Custo Mensal (sem provisões)', custoSemProv],
        ['Custo Total (com provisões)', custoTotalMensal],
        ['% Encargos s/ Salário Bruto', PCT(encargoPct)],
        ['% Custo Total s/ Salário Bruto', PCT(custoTotalPct)],
      ]

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['A1'].s = { font: { bold: true, sz: 14 } }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Custo CLT')
      XLSX.writeFile(wb, 'custo_empregado_clt.xlsx')
    } catch (e) {
      console.error('Erro ao exportar:', e)
      alert('Erro ao exportar. Verifique o console.')
    }
  }

  type RowType = 'grupo' | 'subtotal' | 'footer' | 'normal'
  interface TableRow {
    label: string
    value: number
    type?: RowType
    aliq?: string
    note?: string
  }

  const tableRows: TableRow[] = [
    { label: 'REMUNERAÇÃO', value: 0, type: 'grupo' },
    { label: 'Salário Base', value: salBaseN },
    { label: `Insalubridade (${PCT(insal)} sobre salário mínimo R$ ${salMinN.toFixed(2).replace('.', ',')})`, value: insalN, aliq: chkInsal ? PCT(insal) : '—' },
    { label: 'Periculosidade (30% s/ salário base)', value: pericN, aliq: chkPeric ? '30%' : '—' },
    { label: 'Salário Bruto', value: bruto, type: 'subtotal' },

    { label: 'ENCARGOS PATRONAIS DIRETOS', value: 0, type: 'grupo' },
    { label: 'CPP / INSS Patronal', value: cpp, aliq: PCT(aliqInss) },
    { label: 'GILRAT (Grau de Risco)', value: gilrat, aliq: PCT(gilratDireto) },
    { label: 'Sistema S / Terceiros', value: terc, aliq: PCT(aliqTerc) },
    { label: 'FGTS', value: fgts, aliq: PCT(aliqFgts) },
    { label: 'Total Encargos Diretos', value: totalEncDiretos, type: 'subtotal' },
    { label: `Encargo Efetivo sobre Bruto`, value: 0, type: 'grupo', note: `${encargoPct.toFixed(2).replace('.', ',')}%` },

    { label: 'PROVISÕES MENSAIS', value: 0, type: 'grupo' },
    { label: '1/12 Férias', value: provFerias, aliq: '8,33%' },
    { label: '1/12 13º Salário', value: provDecimo, aliq: '8,33%' },
    { label: `Encargos s/ Provisões (${PCT(aliqEncProv)})`, value: encProv },
    { label: 'Provisão Multa FGTS', value: provMulta, aliq: PCT(aliqMulta) },
    { label: 'Total Provisões', value: totalProvisoes, type: 'subtotal' },

    { label: 'BENEFÍCIOS E CUSTOS VARIÁVEIS', value: 0, type: 'grupo' },
    { label: 'Vale-Transporte (custo empresa)', value: vtLiq },
    { label: 'Vale-Refeição (custo empresa)', value: vrLiq },
    { label: 'Plano de Saúde', value: planoSaudeN },
    { label: 'Outros Benefícios', value: outrosN },
    { label: 'Total Benefícios', value: totalBeneficios, type: 'subtotal' },
  ]

  return (
    <div className="page">
      <div className="card">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Painel DP
        </button>

        <h1 className="title">Custo de Empregado (CLT)</h1>

        <div className="top-actions">
          <button className="btn-export" onClick={exportarExcel}>↓ Exportar Excel</button>
          <button className="btn-limpar" onClick={limpar}>✕ Limpar</button>
          <span className="badge badge-orange">CLT 2026</span>
        </div>

        {/* Section 1: Dados Cadastrais */}
        <div className="section">
          <div className="section-header">
            <h2>1. Dados Cadastrais</h2>
          </div>
          <div className="section-body">
            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Regime Tributário</label>
                <select value={regime} onChange={e => handleRegimeChange(e.target.value as Regime)}>
                  <option value="real_presumido">Lucro Real / Presumido</option>
                  <option value="simples">Simples Nacional</option>
                  <option value="autonomo">Autônomo / Pró-labore</option>
                </select>
              </div>
              <div className="field">
                <label>Salário Base (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 3500.00"
                  value={salBase}
                  onChange={e => setSalBase(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="adicionais-titulo">Adicionais de Remuneração</div>
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div>
                <label className="check-line" style={{ marginBottom: 8 }}>
                  <input type="checkbox" checked={chkInsal} onChange={e => setChkInsal(e.target.checked)} />
                  Insalubridade
                </label>
                {chkInsal && (
                  <div className="field">
                    <label>Grau de Insalubridade (%)</label>
                    <select value={insal} onChange={e => setInsal(e.target.value)}>
                      <option value="10">10% — Mínimo (grau mínimo)</option>
                      <option value="20">20% — Médio (grau médio)</option>
                      <option value="40">40% — Máximo (grau máximo)</option>
                    </select>
                    <span className="help">Base: Salário Mínimo ({BRL(salMinN)})</span>
                  </div>
                )}
              </div>
              <div>
                <label className="check-line">
                  <input type="checkbox" checked={chkPeric} onChange={e => setChkPeric(e.target.checked)} />
                  Periculosidade (30% sobre salário base)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Alíquotas Patronais */}
        <div className="section">
          <div className="section-header">
            <h2>2. Alíquotas Patronais</h2>
            <span className="badge badge-orange" style={{ marginLeft: 'auto' }}>{REGIMES[regime].label}</span>
          </div>
          <div className="section-body">
            <div className="grid grid-4">
              <div className="field">
                <label>CPP / INSS (%)</label>
                <input type="number" value={aliqInss} onChange={e => setAliqInss(e.target.value)} step="0.01" min="0" />
                <span className="help">Padrão: 20%</span>
              </div>
              <div className="field">
                <label>GILRAT (%)</label>
                <input type="number" value={gilratDireto} onChange={e => setGilratDireto(e.target.value)} step="0.01" min="0" />
                <span className="help">Grau de risco: 1,0% / 2,0% / 3,0%</span>
              </div>
              <div className="field">
                <label>Sistema S / Terceiros (%)</label>
                <input type="number" value={aliqTerc} onChange={e => setAliqTerc(e.target.value)} step="0.01" min="0" />
                <span className="help">Padrão: 5,80%</span>
              </div>
              <div className="field">
                <label>FGTS (%)</label>
                <input type="number" value={aliqFgts} onChange={e => setAliqFgts(e.target.value)} step="0.01" min="0" />
                <span className="help">Padrão: 8%</span>
              </div>
            </div>
            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <div className="field">
                <label>Multa Rescisória s/ FGTS (%)</label>
                <input type="number" value={aliqMulta} onChange={e => setAliqMulta(e.target.value)} step="0.01" min="0" />
                <span className="help">Provisão: 40% (sem justa causa)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Benefícios */}
        <div className="section">
          <div className="section-header">
            <h2>3. Benefícios</h2>
          </div>
          <div className="section-body">
            <div className="grid grid-2">
              <div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Vale-Transporte Total (R$)</label>
                  <input type="number" value={vtTotal} onChange={e => setVtTotal(e.target.value)} min="0" step="0.01" />
                </div>
                <div className="field">
                  <label>Desconto VT do Empregado (%)</label>
                  <input type="number" value={vtDesc} onChange={e => setVtDesc(e.target.value)} min="0" max="6" step="0.01" />
                  <span className="help">Máx: 6% do salário base</span>
                </div>
              </div>
              <div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Vale-Refeição Total (R$)</label>
                  <input type="number" value={vrTotal} onChange={e => setVrTotal(e.target.value)} min="0" step="0.01" />
                </div>
                <div className="field">
                  <label>Desconto VR do Empregado (%)</label>
                  <input type="number" value={vrDesc} onChange={e => setVrDesc(e.target.value)} min="0" step="0.01" />
                </div>
              </div>
              <div className="field">
                <label>Plano de Saúde (custo empresa, R$)</label>
                <input type="number" value={planoSaude} onChange={e => setPlanoSaude(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="field">
                <label>Outros Benefícios (R$)</label>
                <input type="number" value={outros} onChange={e => setOutros(e.target.value)} min="0" step="0.01" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Demonstrativo */}
        <div className="section">
          <div className="section-header">
            <h2>4. Demonstrativo de Custo</h2>
            <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Salário Bruto: {BRL(bruto)}</span>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="demo">
                <thead>
                  <tr>
                    <th style={{ width: '55%' }}>Descrição</th>
                    <th>Alíquota</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    if (row.type === 'grupo') {
                      return (
                        <tr key={i} className="group-row">
                          <td colSpan={2}>{row.label}</td>
                          <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--ink)' }}>
                            {row.note || ''}
                          </td>
                        </tr>
                      )
                    }
                    if (row.type === 'subtotal') {
                      return (
                        <tr key={i} className="subtotal-row">
                          <td colSpan={2}>{row.label}</td>
                          <td>{BRL(row.value)}</td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={i}>
                        <td>{row.label}</td>
                        <td style={{ color: 'var(--ink-muted)', fontSize: '12px' }}>{row.aliq || '—'}</td>
                        <td>{BRL(row.value)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Custo Mensal (sem provisões)</td>
                    <td>{PCT(bruto > 0 ? (custoSemProv / bruto - 1) * 100 : 0)} s/ bruto</td>
                    <td>{BRL(custoSemProv)}</td>
                  </tr>
                  <tr>
                    <td>CUSTO TOTAL (com provisões)</td>
                    <td>{PCT(custoTotalPct - 100)} encargos s/ bruto</td>
                    <td>{BRL(custoTotalMensal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="stats-row">
          <div className="stat-box blue">
            <div className="stat-label">Salário Bruto</div>
            <div className="stat-value">{BRL(bruto)}</div>
          </div>
          <div className="stat-box orange">
            <div className="stat-label">Encargos Diretos</div>
            <div className="stat-value">{BRL(totalEncDiretos)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Provisões</div>
            <div className="stat-value">{BRL(totalProvisoes)}</div>
          </div>
          <div className="stat-box green">
            <div className="stat-label">Custo Total</div>
            <div className="stat-value">{BRL(custoTotalMensal)}</div>
          </div>
        </div>

        <div className="info-irrf">
          <strong>ℹ️ Encargos Patronais 2026:</strong> CPP (INSS Patronal): 20% | GILRAT: varia conforme grau de risco (1%, 2% ou 3%) | Sistema S/Terceiros: 5,8% (Sesi/Senai/Sesc/Senac/Sebrae/Incra/Fnde) | FGTS: 8% | Multa rescisória: 40% sobre o saldo do FGTS. Insalubridade calculada sobre o Salário Mínimo conforme Súmula nº 17 do TST. Periculosidade: 30% sobre o salário base (art. 193 CLT).
        </div>
      </div>
    </div>
  )
}
