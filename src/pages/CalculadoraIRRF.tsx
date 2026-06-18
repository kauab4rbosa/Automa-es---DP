import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FAIXAS_IRRF,
  FAIXAS_INSS,
  DEDUCAO_DEPENDENTE,
  DESCONTO_SIMPLIFICADO,
  REDUTOR_ISENCAO,
  REDUTOR_TETO,
  calcINSS,
  calcReducao15270,
} from '../constants/taxTables'
import { BRL, numVal } from '../utils/currency'

function calcIRRFTabela(base: number) {
  for (let i = 0; i < FAIXAS_IRRF.length; i++) {
    if (base <= FAIXAS_IRRF[i].limite) {
      const valor = Math.max(0, Math.round((base * FAIXAS_IRRF[i].aliq - FAIXAS_IRRF[i].deduz) * 100) / 100)
      return { ...FAIXAS_IRRF[i], valor, faixaIndex: i }
    }
  }
  return { ...FAIXAS_IRRF[0], valor: 0, faixaIndex: 0 }
}

function pct(v: number) {
  return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

function fmtLimite(v: number) {
  if (v === Infinity) return 'Acima'
  return BRL(v)
}

interface ResultSet {
  // Inputs
  bruto: number
  pensaoN: number
  outrasN: number
  dependentesN: number
  isProlabore: boolean
  // INSS
  inss: ReturnType<typeof calcINSS>
  // Legal model
  baseCompleto: number
  irrfCompleto: ReturnType<typeof calcIRRFTabela>
  reducaoCompleto: ReturnType<typeof calcReducao15270>
  finalCompleto: number
  // Simplificado model
  baseSimplificado: number
  irrfSimplificado: ReturnType<typeof calcIRRFTabela>
  reducaoSimplificado: ReturnType<typeof calcReducao15270>
  finalSimplificado: number
  // Winner
  winner: 'completo' | 'simplificado'
}

export default function CalculadoraIRRF() {
  const navigate = useNavigate()

  const [salario, setSalario] = useState('')
  const [pensao, setPensao] = useState('')
  const [outras, setOutras] = useState('')
  const [dependentes, setDependentes] = useState('0')
  const [isProlabore, setIsProlabore] = useState(false)
  const [result, setResult] = useState<ResultSet | null>(null)

  function calcular() {
    const salN = numVal(salario)
    const pensaoN = numVal(pensao)
    const outrasN = numVal(outras)
    const depN = parseInt(dependentes) || 0
    const bruto = salN + pensaoN + outrasN

    const inss = calcINSS(salN, isProlabore)

    // Modelo deduções legais
    const baseCompleto = Math.max(0, bruto - inss.valor - pensaoN - depN * DEDUCAO_DEPENDENTE - outrasN)
    const irrfCompleto = calcIRRFTabela(baseCompleto)
    const reducaoCompleto = calcReducao15270(bruto, irrfCompleto.valor)
    const finalCompleto = Math.max(0, irrfCompleto.valor - reducaoCompleto.valor)

    // Modelo desconto simplificado
    const baseSimplificado = Math.max(0, bruto - DESCONTO_SIMPLIFICADO)
    const irrfSimplificado = calcIRRFTabela(baseSimplificado)
    const reducaoSimplificado = calcReducao15270(bruto, irrfSimplificado.valor)
    const finalSimplificado = Math.max(0, irrfSimplificado.valor - reducaoSimplificado.valor)

    const winner = finalSimplificado <= finalCompleto ? 'simplificado' : 'completo'

    setResult({
      bruto,
      pensaoN,
      outrasN,
      dependentesN: depN,
      isProlabore,
      inss,
      baseCompleto,
      irrfCompleto,
      reducaoCompleto,
      finalCompleto,
      baseSimplificado,
      irrfSimplificado,
      reducaoSimplificado,
      finalSimplificado,
      winner,
    })
  }

  function limpar() {
    setSalario('')
    setPensao('')
    setOutras('')
    setDependentes('0')
    setIsProlabore(false)
    setResult(null)
  }

  return (
    <div className="page">
      <div className="card">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Painel DP
        </button>

        <h1 className="title">Calculadora IRRF 2026</h1>

        <div className="top-actions">
          <span className="badge badge-orange">Lei 15.270/2025</span>
          <span className="badge badge-gray">Tabela 2026</span>
          <button className="btn-limpar" onClick={limpar} style={{ marginLeft: 'auto' }}>✕ Limpar</button>
        </div>

        {/* Section 1: Dados */}
        <div className="section">
          <div className="section-header">
            <h2>1. Rendimentos e Deduções</h2>
          </div>
          <div className="section-body">
            <div className="grid grid-2" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Salário / Remuneração (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 5000.00"
                  value={salario}
                  onChange={e => setSalario(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="field">
                <label>Pensão Alimentícia (R$)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={pensao}
                  onChange={e => setPensao(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <span className="help">Pago pelo contribuinte (dedução legal)</span>
              </div>
              <div className="field">
                <label>Outros Rendimentos (R$)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={outras}
                  onChange={e => setOutras(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="field">
                <label>Número de Dependentes</label>
                <input
                  type="number"
                  value={dependentes}
                  onChange={e => setDependentes(e.target.value)}
                  min="0"
                  max="20"
                />
                <span className="help">R$ {DEDUCAO_DEPENDENTE.toFixed(2).replace('.', ',')} por dependente</span>
              </div>
            </div>
            <label className="check-line">
              <input
                type="checkbox"
                checked={isProlabore}
                onChange={e => setIsProlabore(e.target.checked)}
              />
              Pró-labore (sócio/administrador — INSS 11% fixo até o teto)
            </label>
          </div>
        </div>

        {/* Section 2: Tabela INSS */}
        <div className="section">
          <div className="section-header">
            <h2>2. Tabela INSS 2026</h2>
            <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>Teto: {BRL(8475.55)}</span>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="demo">
                <thead>
                  <tr>
                    <th>Faixa</th>
                    <th>Salário até</th>
                    <th>Alíquota</th>
                    <th>Dedução fixa</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { ate: 1621.00, aliq: 0.075, ded: 0.00 },
                    { ate: 2902.84, aliq: 0.090, ded: 24.32 },
                    { ate: 4354.27, aliq: 0.120, ded: 111.42 },
                    { ate: 8475.55, aliq: 0.140, ded: 198.50 },
                  ].map((f, i) => (
                    <tr key={i}>
                      <td>{i + 1}ª faixa</td>
                      <td>{BRL(f.ate)}</td>
                      <td>{pct(f.aliq)}</td>
                      <td>{BRL(f.ded)}</td>
                    </tr>
                  ))}
                  {FAIXAS_INSS.map((_, i) => null)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 3: Tabela IRRF */}
        <div className="section">
          <div className="section-header">
            <h2>3. Tabela IRRF 2026</h2>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="demo">
                <thead>
                  <tr>
                    <th>Faixa</th>
                    <th>Base de cálculo até</th>
                    <th>Alíquota</th>
                    <th>Parcela a deduzir</th>
                  </tr>
                </thead>
                <tbody>
                  {FAIXAS_IRRF.map((f, i) => (
                    <tr
                      key={i}
                      className={
                        result
                          ? (result.winner === 'simplificado'
                              ? (result.irrfSimplificado.faixaIndex === i ? 'faixa-row active' : 'faixa-row')
                              : (result.irrfCompleto.faixaIndex === i ? 'faixa-row active' : 'faixa-row'))
                          : ''
                      }
                    >
                      <td>{i === 0 ? 'Isento' : `${i + 1}ª faixa`}</td>
                      <td>{fmtLimite(f.limite)}</td>
                      <td>{f.aliq === 0 ? 'Isento' : pct(f.aliq)}</td>
                      <td>{BRL(f.deduz)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
          <button className="btn-calcular" onClick={calcular}>
            ▶ Calcular IRRF
          </button>
          <button className="btn-limpar-calc" onClick={limpar}>
            ✕ Limpar
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            <div className="sep" />

            {/* Summary Stats */}
            <div className="stats-row">
              <div className="stat-box blue">
                <div className="stat-label">Salário Bruto</div>
                <div className="stat-value">{BRL(result.bruto)}</div>
              </div>
              <div className="stat-box orange">
                <div className="stat-label">INSS {result.isProlabore ? '(11% pró-labore)' : '(progressivo)'}</div>
                <div className="stat-value">{BRL(result.inss.valor)}</div>
              </div>
              <div className={`stat-box ${result.winner === 'simplificado' ? 'green' : 'red'}`}>
                <div className="stat-label">IRRF ({result.winner === 'simplificado' ? 'Simplificado ✓' : 'Completo ✓'})</div>
                <div className="stat-value">
                  {result.winner === 'simplificado' ? BRL(result.finalSimplificado) : BRL(result.finalCompleto)}
                </div>
              </div>
              <div className="stat-box green">
                <div className="stat-label">Salário Líquido</div>
                <div className="stat-value">
                  {BRL(result.bruto - result.inss.valor - (result.winner === 'simplificado' ? result.finalSimplificado : result.finalCompleto))}
                </div>
              </div>
            </div>

            {/* Two result cards */}
            <div className="result-cards">
              {/* Deduções Legais */}
              <div className={`result-card ${result.winner === 'completo' ? 'winner' : ''}`}>
                {result.winner === 'completo' && <span className="vantajosa-badge">Mais Vantajosa</span>}
                <h3>Modelo: Deduções Legais</h3>
                <div className={`result-value ${result.finalCompleto === 0 ? 'zero' : ''}`}>
                  {BRL(result.finalCompleto)}
                </div>
                <div className="result-label">IRRF a recolher</div>
                <div className="result-detail">
                  <strong>Base de cálculo:</strong> {BRL(result.baseCompleto)}<br />
                  <strong>IRRF (tabela):</strong> {BRL(result.irrfCompleto.valor)}<br />
                  <strong>Alíquota efetiva:</strong> {result.bruto > 0 ? ((result.finalCompleto / result.bruto) * 100).toFixed(2).replace('.', ',') + '%' : '0,00%'}<br />
                  {result.reducaoCompleto.valor > 0 && (
                    <><strong>Redutor 15.270/2025:</strong> −{BRL(result.reducaoCompleto.valor)}<br /></>
                  )}
                  <strong>Deduções:</strong> INSS {BRL(result.inss.valor)}
                  {result.dependentesN > 0 && ` + ${result.dependentesN} dep. (${BRL(result.dependentesN * DEDUCAO_DEPENDENTE)})`}
                  {result.pensaoN > 0 && ` + pensão ${BRL(result.pensaoN)}`}
                </div>
              </div>

              {/* Desconto Simplificado */}
              <div className={`result-card ${result.winner === 'simplificado' ? 'winner' : ''}`}>
                {result.winner === 'simplificado' && <span className="vantajosa-badge">Mais Vantajosa</span>}
                <h3>Modelo: Desconto Simplificado</h3>
                <div className={`result-value ${result.finalSimplificado === 0 ? 'zero' : ''}`}>
                  {BRL(result.finalSimplificado)}
                </div>
                <div className="result-label">IRRF a recolher</div>
                <div className="result-detail">
                  <strong>Base de cálculo:</strong> {BRL(result.baseSimplificado)}<br />
                  <strong>IRRF (tabela):</strong> {BRL(result.irrfSimplificado.valor)}<br />
                  <strong>Alíquota efetiva:</strong> {result.bruto > 0 ? ((result.finalSimplificado / result.bruto) * 100).toFixed(2).replace('.', ',') + '%' : '0,00%'}<br />
                  {result.reducaoSimplificado.valor > 0 && (
                    <><strong>Redutor 15.270/2025:</strong> −{BRL(result.reducaoSimplificado.valor)}<br /></>
                  )}
                  <strong>Desconto:</strong> {BRL(DESCONTO_SIMPLIFICADO)} (padrão legal)
                </div>
              </div>
            </div>

            {/* Memória de Cálculo */}
            <div className="memoria-section">
              <h2>📋 Memória de Cálculo</h2>
              <div className="memoria-grid">
                {/* INSS memory */}
                <div className="memoria-card">
                  <h3>INSS do Segurado</h3>
                  <div className="memoria-row">
                    <span className="label">Salário base</span>
                    <span className="value">{BRL(numVal(salario))}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">Alíquota/faixa</span>
                    <span className="value">{result.isProlabore ? '11% (pró-labore)' : pct(result.inss.aliquota)}</span>
                  </div>
                  {!result.isProlabore && result.inss.deducao > 0 && (
                    <div className="memoria-row">
                      <span className="label">Dedução fixa</span>
                      <span className="value">−{BRL(result.inss.deducao)}</span>
                    </div>
                  )}
                  {result.inss.isTeto && (
                    <div className="memoria-row">
                      <span className="label" style={{ color: 'var(--orange)' }}>⚠️ Teto INSS atingido</span>
                      <span className="value">{BRL(8475.55)}</span>
                    </div>
                  )}
                  <div className="memoria-row total">
                    <span className="label">INSS a recolher</span>
                    <span className="value">{BRL(result.inss.valor)}</span>
                  </div>
                </div>

                {/* Redutor */}
                <div className="memoria-card">
                  <h3>Redutor — Lei 15.270/2025</h3>
                  <div className="memoria-row">
                    <span className="label">Rendimento bruto</span>
                    <span className="value">{BRL(result.bruto)}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">Faixa de isenção</span>
                    <span className="value">até {BRL(REDUTOR_ISENCAO)}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">Redução gradual</span>
                    <span className="value">{BRL(REDUTOR_ISENCAO)} a {BRL(REDUTOR_TETO)}</span>
                  </div>
                  <div className="memoria-row total">
                    <span className="label">Fórmula aplicada</span>
                    <span className="value" style={{ fontSize: '11px', textAlign: 'right', maxWidth: '160px' }}>
                      {result.winner === 'simplificado'
                        ? result.reducaoSimplificado.formula
                        : result.reducaoCompleto.formula}
                    </span>
                  </div>
                </div>

                {/* Modelo Completo */}
                <div className="memoria-card">
                  <h3>Modelo Deduções Legais</h3>
                  <div className="memoria-row">
                    <span className="label">Rendimento bruto</span>
                    <span className="value">{BRL(result.bruto)}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">INSS</span>
                    <span className="value">−{BRL(result.inss.valor)}</span>
                  </div>
                  {result.pensaoN > 0 && (
                    <div className="memoria-row">
                      <span className="label">Pensão alimentícia</span>
                      <span className="value">−{BRL(result.pensaoN)}</span>
                    </div>
                  )}
                  {result.dependentesN > 0 && (
                    <div className="memoria-row">
                      <span className="label">{result.dependentesN} dependente(s)</span>
                      <span className="value">−{BRL(result.dependentesN * DEDUCAO_DEPENDENTE)}</span>
                    </div>
                  )}
                  <div className="memoria-row">
                    <span className="label">Base de cálculo</span>
                    <span className="value">{BRL(result.baseCompleto)}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">IRRF s/ tabela</span>
                    <span className="value">{BRL(result.irrfCompleto.valor)}</span>
                  </div>
                  <div className="memoria-row destaque total">
                    <span className="label">IRRF final</span>
                    <span className="value">{BRL(result.finalCompleto)}</span>
                  </div>
                </div>

                {/* Modelo Simplificado */}
                <div className="memoria-card">
                  <h3>Modelo Desconto Simplificado</h3>
                  <div className="memoria-row">
                    <span className="label">Rendimento bruto</span>
                    <span className="value">{BRL(result.bruto)}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">Desconto simplificado</span>
                    <span className="value">−{BRL(DESCONTO_SIMPLIFICADO)}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">Base de cálculo</span>
                    <span className="value">{BRL(result.baseSimplificado)}</span>
                  </div>
                  <div className="memoria-row">
                    <span className="label">IRRF s/ tabela</span>
                    <span className="value">{BRL(result.irrfSimplificado.valor)}</span>
                  </div>
                  <div className="memoria-row destaque total">
                    <span className="label">IRRF final</span>
                    <span className="value">{BRL(result.finalSimplificado)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="info-irrf" style={{ marginTop: 24 }}>
          <strong>ℹ️ IRRF 2026 — Lei 15.270/2025:</strong> Isenção total para rendimentos até {BRL(REDUTOR_ISENCAO)}. Redução gradual entre {BRL(REDUTOR_ISENCAO)} e {BRL(REDUTOR_TETO)} (fórmula: R$ 978,62 − 0,133145 × rendimento). Desconto simplificado substitui todas as deduções legais por {BRL(DESCONTO_SIMPLIFICADO)} fixos. Tabela vigente em 2026 conforme Instrução Normativa RFB.
        </div>
      </div>
    </div>
  )
}
