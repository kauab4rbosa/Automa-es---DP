import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calcInssSegurado, calcIrrf } from '../constants/taxTables'
import { BRL, PCT, numVal } from '../utils/currency'

export default function CustoEmpregadoDomestico() {
  const navigate = useNavigate()

  const [salBase, setSalBase] = useState('')
  const [depend, setDepend] = useState(0)
  const [chkHorasExtras, setChkHorasExtras] = useState(false)
  const [horasExtras, setHorasExtras] = useState('0')
  const [chkVT, setChkVT] = useState(false)
  const [vtTotal, setVtTotal] = useState('0')
  const [aliqInssPat, setAliqInssPat] = useState('8.00')
  const [aliqGilrat, setAliqGilrat] = useState('0.80')
  const [aliqFgts, setAliqFgts] = useState('8.00')
  const [aliqMulta, setAliqMulta] = useState('3.20')

  // Computed values
  const salBaseN = numVal(salBase)
  const heN = chkHorasExtras ? numVal(horasExtras) : 0
  const bruto = salBaseN + heN
  const inssSeg = calcInssSegurado(bruto)
  const irrfObj = calcIrrf(bruto, inssSeg, depend)
  const irrf = irrfObj.valor
  const totalRetencoes = inssSeg + irrf
  const inssPat = bruto * (numVal(aliqInssPat) / 100)
  const gilrat = bruto * (numVal(aliqGilrat) / 100)
  const fgts = bruto * (numVal(aliqFgts) / 100)
  const multa = bruto * (numVal(aliqMulta) / 100)
  const totalPatronal = inssPat + gilrat + fgts + multa
  const totalDAE = totalRetencoes + totalPatronal
  const ferias = bruto * (11.1111 / 100)
  const decimo = bruto * (8.3333 / 100)
  const baseProv = ferias + decimo
  const aliqEncProv = numVal(aliqInssPat) + numVal(aliqGilrat) + numVal(aliqFgts) + numVal(aliqMulta)
  const encProv = baseProv * (aliqEncProv / 100)
  const totalProv = ferias + decimo + encProv
  const vtTotalN = chkVT ? numVal(vtTotal) : 0
  const vtDesc = Math.min(vtTotalN, salBaseN * 0.06)
  const vtLiq = vtTotalN - vtDesc
  const liquidoEmpregado = bruto - inssSeg - irrf
  const custoMensal = liquidoEmpregado + totalDAE + vtLiq
  const custoComProv = custoMensal + totalProv

  function limpar() {
    setSalBase('')
    setDepend(0)
    setChkHorasExtras(false)
    setHorasExtras('0')
    setChkVT(false)
    setVtTotal('0')
    setAliqInssPat('8.00')
    setAliqGilrat('0.80')
    setAliqFgts('8.00')
    setAliqMulta('3.20')
  }

  async function exportarExcel() {
    try {
      const XLSX = await import('xlsx-js-style')

      const rows: any[][] = [
        ['CUSTO DE EMPREGADO DOMÉSTICO — SIMPLES DOMÉSTICO'],
        [],
        ['Salário Base', salBaseN],
        ['Horas Extras', heN],
        ['Salário Bruto', bruto],
        [],
        ['RETENÇÕES DO EMPREGADO'],
        ['INSS Segurado (Progressivo)', inssSeg],
        ['IRRF (' + irrfObj.modelo + ')', irrf],
        ['Total Retenções', totalRetencoes],
        [],
        ['ENCARGOS PATRONAIS — DAE'],
        ['INSS Patronal (' + PCT(aliqInssPat) + ')', inssPat],
        ['GILRAT (' + PCT(aliqGilrat) + ')', gilrat],
        ['FGTS (' + PCT(aliqFgts) + ')', fgts],
        ['Multa FGTS (' + PCT(aliqMulta) + ')', multa],
        ['Total Patronal', totalPatronal],
        ['Total DAE', totalDAE],
        [],
        ['PROVISÕES MENSAIS'],
        ['1/12 Férias', ferias],
        ['1/12 13º Salário', decimo],
        ['Encargos s/ Provisões (' + PCT(aliqEncProv) + ')', encProv],
        ['Total Provisões', totalProv],
        [],
        ['VALE-TRANSPORTE'],
        ['VT Total', vtTotalN],
        ['Desconto do Empregado (6%)', vtDesc],
        ['VT Líquido (custo empresa)', vtLiq],
        [],
        ['RESUMO'],
        ['Salário Líquido do Empregado', liquidoEmpregado],
        ['Custo Mensal (sem provisões)', custoMensal],
        ['Custo Total (com provisões)', custoComProv],
      ]

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['A1'].s = { font: { bold: true, sz: 14 } }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Custo Doméstico')

      XLSX.writeFile(wb, 'custo_empregado_domestico.xlsx')
    } catch (e) {
      console.error('Erro ao exportar:', e)
      alert('Erro ao exportar. Verifique o console.')
    }
  }

  const tableRows: { label: string; value: number; type?: 'grupo' | 'subtotal' | 'footer' | 'normal'; aliq?: string }[] = [
    { label: 'REMUNERAÇÃO', value: 0, type: 'grupo' },
    { label: 'Salário Base', value: salBaseN },
    { label: 'Horas Extras', value: heN },
    { label: 'Salário Bruto', value: bruto, type: 'subtotal' },
    { label: 'RETENÇÕES DO EMPREGADO', value: 0, type: 'grupo' },
    { label: 'INSS Segurado (Progressivo)', value: inssSeg, aliq: '7,5% a 14%' },
    { label: `IRRF (${irrfObj.modelo})`, value: irrf },
    { label: 'Total Retenções', value: totalRetencoes, type: 'subtotal' },
    { label: 'Salário Líquido do Empregado', value: liquidoEmpregado, type: 'subtotal' },
    { label: 'ENCARGOS PATRONAIS — DAE', value: 0, type: 'grupo' },
    { label: 'INSS Patronal', value: inssPat, aliq: PCT(aliqInssPat) },
    { label: 'GILRAT', value: gilrat, aliq: PCT(aliqGilrat) },
    { label: 'FGTS', value: fgts, aliq: PCT(aliqFgts) },
    { label: 'Multa Rescisória FGTS', value: multa, aliq: PCT(aliqMulta) },
    { label: 'Total Patronal DAE', value: totalPatronal, type: 'subtotal' },
    { label: 'Total DAE (Retenções + Patronal)', value: totalDAE, type: 'subtotal' },
    { label: 'PROVISÕES MENSAIS', value: 0, type: 'grupo' },
    { label: '1/12 Férias', value: ferias, aliq: '11,11%' },
    { label: '1/12 13º Salário', value: decimo, aliq: '8,33%' },
    { label: `Encargos s/ Provisões (${PCT(aliqEncProv)})`, value: encProv },
    { label: 'Total Provisões', value: totalProv, type: 'subtotal' },
    { label: 'VALE-TRANSPORTE', value: 0, type: 'grupo' },
    { label: 'VT Total', value: vtTotalN },
    { label: 'Desconto do Empregado (6%)', value: -vtDesc },
    { label: 'VT Líquido (custo empresa)', value: vtLiq, type: 'subtotal' },
    { label: 'CUSTO MENSAL (sem provisões)', value: custoMensal, type: 'subtotal' },
    { label: 'CUSTO TOTAL COM PROVISÕES', value: custoComProv, type: 'footer' },
  ]

  return (
    <div className="page">
      <div className="card">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Painel DP
        </button>

        <h1 className="title">Custo de Empregado Doméstico</h1>

        <div className="top-actions">
          <button className="btn-export" onClick={exportarExcel}>
            ↓ Exportar Excel
          </button>
          <button className="btn-limpar" onClick={limpar}>
            ✕ Limpar
          </button>
          <span className="badge badge-green">Simples Doméstico 2026</span>
          <span className="badge badge-gray">LC 150/2015</span>
        </div>

        {/* Section 1: Dados e Salário */}
        <div className="section">
          <div className="section-header">
            <h2>1. Dados e Salário</h2>
          </div>
          <div className="section-body">
            <div className="grid-cadastro">
              <div className="col-esquerda">
                <div className="field">
                  <label>Salário Base (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 1621.00"
                    value={salBase}
                    onChange={e => setSalBase(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="field">
                  <label>Dependentes (IRRF)</label>
                  <input
                    type="number"
                    value={depend}
                    onChange={e => setDepend(Number(e.target.value))}
                    min="0"
                    max="20"
                  />
                  <span className="help">R$ 189,59 por dependente</span>
                </div>
              </div>
              <div className="col-direita">
                <div className="adicionais-titulo">Adicionais</div>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={chkHorasExtras}
                    onChange={e => setChkHorasExtras(e.target.checked)}
                  />
                  Horas Extras
                </label>
                {chkHorasExtras && (
                  <div className="field">
                    <label>Valor das Horas Extras (R$)</label>
                    <input
                      type="number"
                      value={horasExtras}
                      onChange={e => setHorasExtras(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={chkVT}
                    onChange={e => setChkVT(e.target.checked)}
                  />
                  Vale-Transporte
                </label>
                {chkVT && (
                  <div className="field">
                    <label>VT Total (R$)</label>
                    <input
                      type="number"
                      value={vtTotal}
                      onChange={e => setVtTotal(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    <span className="help">Desconto máximo: 6% do salário base</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Alíquotas */}
        <div className="section">
          <div className="section-header">
            <h2>2. Alíquotas do Simples Doméstico</h2>
          </div>
          <div className="section-body">
            <div className="grid grid-4">
              <div className="field">
                <label>INSS Patronal (%)</label>
                <input
                  type="number"
                  value={aliqInssPat}
                  onChange={e => setAliqInssPat(e.target.value)}
                  step="0.01"
                  min="0"
                />
                <span className="help">Padrão: 8%</span>
              </div>
              <div className="field">
                <label>GILRAT (%)</label>
                <input
                  type="number"
                  value={aliqGilrat}
                  onChange={e => setAliqGilrat(e.target.value)}
                  step="0.01"
                  min="0"
                />
                <span className="help">Padrão: 0,80%</span>
              </div>
              <div className="field">
                <label>FGTS (%)</label>
                <input
                  type="number"
                  value={aliqFgts}
                  onChange={e => setAliqFgts(e.target.value)}
                  step="0.01"
                  min="0"
                />
                <span className="help">Padrão: 8%</span>
              </div>
              <div className="field">
                <label>Multa FGTS (%)</label>
                <input
                  type="number"
                  value={aliqMulta}
                  onChange={e => setAliqMulta(e.target.value)}
                  step="0.01"
                  min="0"
                />
                <span className="help">Padrão: 3,20%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Demonstrativo */}
        <div className="section">
          <div className="section-header">
            <h2>3. Demonstrativo Detalhado</h2>
            <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Salário Bruto: {BRL(bruto)}</span>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="demo">
                <thead>
                  <tr>
                    <th style={{ width: '60%' }}>Descrição</th>
                    <th>Alíquota</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    if (row.type === 'grupo') {
                      return (
                        <tr key={i} className="group-row">
                          <td colSpan={3}>{row.label}</td>
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
                    <td colSpan={2}>CUSTO TOTAL COM PROVISÕES</td>
                    <td>{BRL(custoComProv)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="info-irrf">
          <strong>ℹ️ IRRF 2026 — Lei 15.270/2025:</strong> Isenção total para rendimentos até R$ 5.000,00. Redução gradual para rendimentos entre R$ 5.000,00 e R$ 7.350,00. O sistema compara automaticamente o modelo de Deduções Legais com o Desconto Simplificado (R$ 607,20) e aplica o mais vantajoso. INSS calculado de forma progressiva conforme LC 150/2015.
        </div>
      </div>
    </div>
  )
}
