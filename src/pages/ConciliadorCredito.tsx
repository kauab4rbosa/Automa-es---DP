import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRL } from '../utils/currency'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanilhaItem {
  bancoCod: string
  banco: string
  contrato: string
  cpf: string
  matricula: string
  nome: string
  totalParc: number
  parcela: number
  competencia: string
}

interface MovItem {
  contrato: string
  valor: number
  tipo: string
}

interface MovEmpregado {
  code: string
  nome: string
  items: MovItem[]
}

interface MovData {
  [nomeUpper: string]: MovEmpregado
}

interface ResultadoLinha {
  codigo: string
  nome: string
  cpf: string
  contratoPlan: string
  contratoMov: string
  parcela: number
  valorMov: number
  status: string
  obs: string
  banco: string
  editadoManualmente: boolean
}

interface StatusMsg {
  msg: string
  tipo: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function fmtCPF(c: string): string {
  const d = String(c || '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3-$4')
  return c
}

// ─── Planilha parser ──────────────────────────────────────────────────────────

async function lerPlanilha(file: File): Promise<PlanilhaItem[]> {
  const XLSX = await import('xlsx-js-style')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Find header row
  let headerIdx = -1
  for (let i = 0; i < Math.min(raw.length, 30); i++) {
    const row = raw[i]
    const joined = row.map((c: any) => norm(String(c))).join('|')
    if (
      joined.includes('CONTRATO') &&
      (joined.includes('CPF') || joined.includes('TRABALHADOR') || joined.includes('NOME'))
    ) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    throw new Error(
      'Cabeçalho não encontrado. Verifique se é a planilha correta de Crédito do Trabalhador do eSocial.'
    )
  }

  const headers = raw[headerIdx].map((h: any) => norm(String(h)))

  function colIdx(candidates: string[]): number {
    for (const c of candidates) {
      const i = headers.findIndex((h: string) => h.includes(c))
      if (i >= 0) return i
    }
    return -1
  }

  const iContrato = colIdx(['CONTRATO'])
  const iCPF = colIdx(['CPF'])
  const iNome = colIdx(['NOME', 'TRABALHADOR'])
  const iMatricula = colIdx(['MATRICULA', 'MATRICULA'])
  const iBancoCod = colIdx(['COD', 'CODIGO BANCO', 'BANCO COD'])
  const iBanco = colIdx(['BANCO'])
  const iTotalParc = colIdx(['VALOR PARCELA', 'VLR PARCELA', 'PARCELA', 'VALOR'])
  const iParcela = colIdx(['NUMERO PARCELA', 'NR PARCELA', 'PARCELA NUM', 'PARC'])
  const iCompetencia = colIdx(['COMPETENCIA', 'COMP'])

  const items: PlanilhaItem[] = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    if (!row || row.every((c: any) => String(c).trim() === '')) continue

    const contrato = String(row[iContrato] ?? '').trim()
    if (!contrato) continue

    const totalParcRaw = row[iTotalParc] ?? 0
    const totalParc =
      typeof totalParcRaw === 'number'
        ? totalParcRaw
        : parseFloat(String(totalParcRaw).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0

    items.push({
      bancoCod: String(row[iBancoCod] ?? '').trim(),
      banco: String(row[iBanco] ?? '').trim(),
      contrato,
      cpf: fmtCPF(String(row[iCPF] ?? '').trim()),
      matricula: String(row[iMatricula] ?? '').trim(),
      nome: String(row[iNome] ?? '').trim(),
      totalParc,
      parcela: parseInt(String(row[iParcela] ?? '0')) || 0,
      competencia: String(row[iCompetencia] ?? '').trim(),
    })
  }

  return items
}

// ─── PDF / Movimentos parser ──────────────────────────────────────────────────

async function lerMovimentos(file: File): Promise<MovData> {
  const pdfjsLib = (window as any).pdfjsLib
  if (!pdfjsLib) throw new Error('PDF.js ainda não carregado. Aguarde alguns segundos e tente novamente.')

  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise

  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(' ')
    fullText += pageText + '\n'
  }

  return parseMovimentos(fullText)
}

function parseMovimentos(texto: string): MovData {
  const data: MovData = {}

  // Patterns to match employee blocks
  // Looks for: CODE NAME ... "Credito do Trabalhador" ... VALUE
  const lines = texto.split(/\n|\r/)

  let currentCode = ''
  let currentNome = ''
  const movItems: { code: string; nome: string; tipo: string; valor: number; contrato: string }[] = []

  // Try to find employee code + name pattern: digits followed by name
  // Common format in Brazilian payroll PDFs: "12345 JOAO DA SILVA"
  const empRegex = /^(\d{4,8})\s+([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇÀÈÌÒÙÄËÏÖÜ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇÀÈÌÒÙÄËÏÖÜ\s]{2,50})/
  const creditoRegex =
    /[Cc]r[eé]dito\s+do\s+[Tt]rabalhador|CREDITO\s+DO\s+TRABALHADOR|CR[EÉ]DITO\s+TRABALHADOR/i
  const valorRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})/g
  const contratoRegex = /(\d{8,20})/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Detect employee line
    const empMatch = empRegex.exec(line)
    if (empMatch) {
      currentCode = empMatch[1]
      currentNome = empMatch[2].trim()
      continue
    }

    // Detect Crédito do Trabalhador line
    if (creditoRegex.test(line)) {
      // Extract value from this line or nearby
      const valores: number[] = []
      let match: RegExpExecArray | null
      const valorRe = /(\d{1,3}(?:\.\d{3})*,\d{2})/g
      while ((match = valorRe.exec(line)) !== null) {
        const v = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
        if (v > 0) valores.push(v)
      }

      // Look ahead up to 3 lines for the value if not found
      if (valores.length === 0) {
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const ahead = lines[j].trim()
          const vm = /(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(ahead)
          if (vm) {
            const v = parseFloat(vm[1].replace(/\./g, '').replace(',', '.'))
            if (v > 0) valores.push(v)
            break
          }
        }
      }

      // Extract contract number (long numeric sequence)
      const contratos: string[] = []
      const cr = /(\d{8,20})/g
      let cm: RegExpExecArray | null
      while ((cm = cr.exec(line)) !== null) {
        contratos.push(cm[1])
      }

      if (currentCode && valores.length > 0) {
        movItems.push({
          code: currentCode,
          nome: currentNome,
          tipo: 'credito_trabalhador',
          valor: valores[0],
          contrato: contratos[0] || '',
        })
      }
    }
  }

  // Build MovData indexed by normalized name
  for (const item of movItems) {
    const key = norm(item.nome)
    if (!data[key]) {
      data[key] = { code: item.code, nome: item.nome, items: [] }
    }
    data[key].items.push({
      contrato: item.contrato,
      valor: item.valor,
      tipo: item.tipo,
    })
  }

  return data
}

// ─── Conciliação ─────────────────────────────────────────────────────────────

function conciliar(planilhaData: PlanilhaItem[], movData: MovData): ResultadoLinha[] {
  const result: ResultadoLinha[] = []

  for (const item of planilhaData) {
    const nomeNorm = norm(item.nome)

    // Try exact match first, then partial
    let empMovimento: MovEmpregado | undefined = movData[nomeNorm]

    if (!empMovimento) {
      // Try partial name match
      for (const key of Object.keys(movData)) {
        if (key.includes(nomeNorm) || nomeNorm.includes(key)) {
          empMovimento = movData[key]
          break
        }
      }
    }

    if (!empMovimento) {
      // Not found in movements — could be dismissed/absent
      result.push({
        codigo: '',
        nome: item.nome,
        cpf: item.cpf,
        contratoPlan: item.contrato,
        contratoMov: '',
        parcela: item.totalParc,
        valorMov: 0,
        status: 'naodesc',
        obs: 'Empregado não encontrado nos movimentos da folha',
        banco: item.banco,
        editadoManualmente: false,
      })
      continue
    }

    // Find matching item by contract (truncated)
    const contratoSuffix = item.contrato.slice(-8)
    let movItem = empMovimento.items.find(
      (m) => m.contrato && m.contrato.endsWith(contratoSuffix)
    )

    if (!movItem && empMovimento.items.length === 1) {
      movItem = empMovimento.items[0]
    }

    if (!movItem) {
      movItem = empMovimento.items.find((m) => Math.abs(m.valor - item.totalParc) < 0.01)
    }

    const valorMov = movItem?.valor ?? 0
    const contratoMov = movItem?.contrato ?? ''

    let status = 'ok'
    let obs = ''

    if (valorMov === 0) {
      status = 'naodesc'
      obs = 'Nenhum desconto encontrado para este contrato'
    } else if (Math.abs(valorMov - item.totalParc) < 0.01) {
      status = 'ok'
      obs = 'Desconto confere'
    } else if (valorMov < item.totalParc) {
      status = 'parcial'
      obs = `Diferença de ${BRL(item.totalParc - valorMov)}`
    } else {
      status = 'ok'
      obs = 'Desconto confere (valor maior ou igual)'
    }

    result.push({
      codigo: empMovimento.code,
      nome: item.nome,
      cpf: item.cpf,
      contratoPlan: item.contrato,
      contratoMov,
      parcela: item.totalParc,
      valorMov,
      status,
      obs,
      banco: item.banco,
      editadoManualmente: false,
    })
  }

  return result
}

function calcularDiferencaNaoDescontada(linha: ResultadoLinha): number {
  if (linha.status === 'naodesc') return linha.parcela
  if (linha.status === 'parcial') return Math.max(0, linha.parcela - linha.valorMov)
  return 0
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ok: { label: 'Descontado', cls: 'badge-ok' },
    parcial: { label: 'Parcial', cls: 'badge-parcial' },
    naodesc: { label: 'Não Desc.', cls: 'badge-naodesc' },
    demitido: { label: 'Demitido', cls: 'badge-status' },
    afastado: { label: 'Afastado', cls: 'badge-status' },
    outro: { label: 'Outro', cls: 'badge-status' },
  }
  const { label, cls } = map[status] || { label: status, cls: 'badge-status' }
  return <span className={`badge-status ${cls}`}>{label}</span>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConciliadorCredito() {
  const navigate = useNavigate()

  const [planilhaData, setPlanilhaData] = useState<PlanilhaItem[] | null>(null)
  const [movData, setMovData] = useState<MovData | null>(null)
  const [resultadoLinhas, setResultadoLinhas] = useState<ResultadoLinha[]>([])
  const [status, setStatus] = useState<StatusMsg | null>(null)
  const [planilhaFileName, setPlanilhaFileName] = useState('')
  const [movFileName, setMovFileName] = useState('')
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [dragOverPlan, setDragOverPlan] = useState(false)
  const [dragOverMov, setDragOverMov] = useState(false)

  const planFileRef = useRef<HTMLInputElement>(null)
  const movFileRef = useRef<HTMLInputElement>(null)

  // Load PDF.js from CDN
  useEffect(() => {
    const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    const PDFJS_WORKER =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

    if ((window as any).pdfjsLib) {
      ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
      setPdfLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = PDFJS_SRC
    script.onload = () => {
      ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
      setPdfLoaded(true)
    }
    script.onerror = () => {
      setStatus({
        msg: 'Falha ao carregar PDF.js. Verifique sua conexão com a internet.',
        tipo: 'error',
      })
    }
    document.head.appendChild(script)
  }, [])

  // Run conciliation when both files are loaded
  useEffect(() => {
    if (planilhaData && movData) {
      const linhas = conciliar(planilhaData, movData)
      setResultadoLinhas(linhas)
      const total = linhas.length
      const ok = linhas.filter((l) => l.status === 'ok').length
      setStatus({
        msg: `Conciliação concluída: ${total} registro(s) analisado(s). ${ok} com desconto total.`,
        tipo: 'success',
      })
    }
  }, [planilhaData, movData])

  const handlePlanilha = useCallback(
    async (file: File) => {
      if (!file) return
      setPlanilhaFileName(file.name)
      setStatus({ msg: 'Lendo planilha eSocial...', tipo: 'info' })
      try {
        const data = await lerPlanilha(file)
        if (data.length === 0) {
          setStatus({ msg: 'Nenhum registro encontrado na planilha.', tipo: 'warn' })
          return
        }
        setPlanilhaData(data)
        setStatus({
          msg: `Planilha carregada: ${data.length} contratos encontrados.${movData ? '' : ' Agora carregue o PDF de movimentos.'}`,
          tipo: movData ? 'info' : 'info',
        })
      } catch (e: any) {
        setStatus({ msg: `Erro na planilha: ${e.message}`, tipo: 'error' })
        setPlanilhaFileName('')
      }
    },
    [movData]
  )

  const handleMovimentos = useCallback(
    async (file: File) => {
      if (!file) return
      if (!pdfLoaded) {
        setStatus({ msg: 'PDF.js ainda carregando, aguarde um momento...', tipo: 'warn' })
        return
      }
      setMovFileName(file.name)
      setStatus({ msg: 'Lendo PDF de movimentos...', tipo: 'info' })
      try {
        const data = await lerMovimentos(file)
        const count = Object.keys(data).length
        setMovData(data)
        setStatus({
          msg: `Movimentos carregados: ${count} empregado(s) com Crédito do Trabalhador encontrado(s).${planilhaData ? '' : ' Agora carregue a planilha eSocial.'}`,
          tipo: 'info',
        })
      } catch (e: any) {
        setStatus({ msg: `Erro no PDF: ${e.message}`, tipo: 'error' })
        setMovFileName('')
      }
    },
    [planilhaData, pdfLoaded]
  )

  function limpar() {
    setPlanilhaData(null)
    setMovData(null)
    setResultadoLinhas([])
    setStatus(null)
    setPlanilhaFileName('')
    setMovFileName('')
    if (planFileRef.current) planFileRef.current.value = ''
    if (movFileRef.current) movFileRef.current.value = ''
  }

  function updateLinha(idx: number, patch: Partial<ResultadoLinha>) {
    setResultadoLinhas((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch, editadoManualmente: true }
      return next
    })
  }

  // Resumo counts
  const resumo = {
    ok: resultadoLinhas.filter((l) => l.status === 'ok').length,
    parcial: resultadoLinhas.filter((l) => l.status === 'parcial').length,
    naodesc: resultadoLinhas.filter((l) => l.status === 'naodesc').length,
    demitido: resultadoLinhas.filter((l) => l.status === 'demitido').length,
    afastado: resultadoLinhas.filter((l) => l.status === 'afastado').length,
    outro: resultadoLinhas.filter((l) => l.status === 'outro').length,
    total: resultadoLinhas.length,
  }

  const totalDescontado = resultadoLinhas
    .filter((l) => l.status === 'ok' || l.status === 'parcial')
    .reduce((s, l) => s + l.valorMov, 0)

  const totalDiferencas = resultadoLinhas.reduce(
    (s, l) => s + calcularDiferencaNaoDescontada(l),
    0
  )

  const totalFGTS = totalDiferencas * 0.08

  async function exportarExcel() {
    if (resultadoLinhas.length === 0) return
    try {
      const XLSX = await import('xlsx-js-style')

      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F2937' } },
        alignment: { horizontal: 'center' as const },
      }

      const headers = [
        'Código',
        'Colaborador',
        'CPF',
        'Nº Contrato (Planilha)',
        'Nº Contrato (Movimentos)',
        'Parcela (Planilha)',
        'Desc. (Movimentos)',
        'Diferença',
        'Status',
        'Banco',
        'Observação',
      ]

      const dataRows = resultadoLinhas.map((l) => [
        l.codigo,
        l.nome,
        l.cpf,
        l.contratoPlan,
        l.contratoMov,
        l.parcela,
        l.valorMov,
        calcularDiferencaNaoDescontada(l),
        l.status,
        l.banco,
        l.obs,
      ])

      const allRows = [headers, ...dataRows]

      const ws = XLSX.utils.aoa_to_sheet(allRows)

      // Style headers
      for (let c = 0; c < headers.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c })
        if (ws[cellRef]) ws[cellRef].s = headerStyle
      }

      // Format currency columns
      for (let r = 1; r <= dataRows.length; r++) {
        for (const col of [5, 6, 7]) {
          const cellRef = XLSX.utils.encode_cell({ r, c: col })
          if (ws[cellRef]) {
            ws[cellRef].t = 'n'
            ws[cellRef].z = '"R$"#,##0.00'
          }
        }
      }

      ws['!cols'] = [
        { wch: 8 },
        { wch: 30 },
        { wch: 16 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 40 },
      ]

      // Summary sheet
      const sumRows = [
        ['RESUMO DA CONCILIAÇÃO'],
        [],
        ['Status', 'Qtd'],
        ['Desconto Total (ok)', resumo.ok],
        ['Desconto Parcial', resumo.parcial],
        ['Não Descontado', resumo.naodesc],
        ['Demitido', resumo.demitido],
        ['Afastado', resumo.afastado],
        ['Outro', resumo.outro],
        ['Total', resumo.total],
        [],
        ['Total Descontado', totalDescontado],
        ['Total Diferenças Não Descontadas', totalDiferencas],
        ['FGTS Digital (8% s/ diferenças)', totalFGTS],
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(sumRows)

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Conciliação')
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo')

      XLSX.writeFile(wb, 'conciliacao_credito_trabalhador.xlsx')
    } catch (e) {
      console.error('Erro ao exportar:', e)
      alert('Erro ao exportar. Verifique o console.')
    }
  }

  const hasResultado = resultadoLinhas.length > 0

  return (
    <div className="page">
      <div className="card">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Painel DP
        </button>

        <h1 className="title">Conciliador de Crédito do Trabalhador</h1>
        <p
          className="subtitle"
          style={{
            textAlign: 'center',
            color: 'var(--ink-muted)',
            fontSize: '14px',
            marginBottom: '28px',
            marginTop: '-16px',
          }}
        >
          Conciliação entre a planilha de Crédito do Trabalhador e os Movimentos da Folha
        </p>

        <div className="top-actions">
          <button
            className="btn-export"
            onClick={exportarExcel}
            disabled={!hasResultado}
            style={{ opacity: hasResultado ? 1 : 0.5, cursor: hasResultado ? 'pointer' : 'not-allowed' }}
          >
            ↓ Exportar Excel
          </button>
          <button className="btn-limpar" onClick={limpar}>
            ✕ Limpar
          </button>
          {!pdfLoaded && (
            <span className="badge badge-gray">Carregando PDF.js...</span>
          )}
          {pdfLoaded && (
            <span className="badge badge-green">PDF.js pronto</span>
          )}
        </div>

        {/* Instructions */}
        <div className="section">
          <div className="section-header">
            <h2>1. Como Obter os Arquivos</h2>
          </div>
          <div className="section-body">
            <div className="upload-grid">
              <div className="instrucoes">
                <strong>Planilha eSocial (.xlsx)</strong>
                <ol>
                  <li>Acesse o portal do <strong>eSocial</strong></li>
                  <li>Vá em <strong>Folha de Pagamento</strong> → <strong>Crédito do Trabalhador</strong></li>
                  <li>Selecione a competência desejada</li>
                  <li>Clique em <strong>Exportar</strong> → <code>.xlsx</code></li>
                </ol>
              </div>
              <div className="instrucoes">
                <strong>Movimentos da Folha (.pdf)</strong>
                <ol>
                  <li>Acesse seu sistema de folha de pagamento</li>
                  <li>Gere o relatório de <strong>Movimentos / Verbas por Empregado</strong></li>
                  <li>Filtre pela verba <strong>Crédito do Trabalhador</strong></li>
                  <li>Exporte em formato <code>.pdf</code></li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* File upload */}
        <div className="section">
          <div className="section-header">
            <h2>2. Anexar Arquivos</h2>
          </div>
          <div className="section-body">
            <div className="upload-grid">
              {/* Planilha uploader */}
              <div
                className={`uploader${planilhaFileName ? ' has-file' : ''}${dragOverPlan ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverPlan(true) }}
                onDragLeave={() => setDragOverPlan(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverPlan(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handlePlanilha(file)
                }}
              >
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div className="title-up">Planilha eSocial (.xlsx)</div>
                <div className="hint">
                  {planilhaFileName
                    ? 'Arquivo carregado com sucesso'
                    : 'Arraste o arquivo ou clique para selecionar'}
                </div>
                {planilhaFileName && (
                  <div className="file-info">
                    {planilhaFileName}
                    <button
                      className="clear-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPlanilhaFileName('')
                        setPlanilhaData(null)
                        if (planFileRef.current) planFileRef.current.value = ''
                        setResultadoLinhas([])
                      }}
                    >
                      Remover
                    </button>
                  </div>
                )}
                <input
                  ref={planFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePlanilha(file)
                  }}
                />
              </div>

              {/* Movimentos uploader */}
              <div
                className={`uploader${movFileName ? ' has-file' : ''}${dragOverMov ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverMov(true) }}
                onDragLeave={() => setDragOverMov(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverMov(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleMovimentos(file)
                }}
              >
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="9" y1="15" x2="9" y2="21"/>
                    <line x1="12" y1="12" x2="12" y2="21"/>
                    <line x1="15" y1="18" x2="15" y2="21"/>
                  </svg>
                </div>
                <div className="title-up">Movimentos da Folha (.pdf)</div>
                <div className="hint">
                  {movFileName
                    ? 'Arquivo carregado com sucesso'
                    : 'Arraste o arquivo ou clique para selecionar'}
                </div>
                {movFileName && (
                  <div className="file-info">
                    {movFileName}
                    <button
                      className="clear-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMovFileName('')
                        setMovData(null)
                        if (movFileRef.current) movFileRef.current.value = ''
                        setResultadoLinhas([])
                      }}
                    >
                      Remover
                    </button>
                  </div>
                )}
                <input
                  ref={movFileRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleMovimentos(file)
                  }}
                />
              </div>
            </div>

            {/* Status message */}
            {status && (
              <div
                className={`status-msg status-${status.tipo}`}
                style={{ marginTop: '14px', marginBottom: 0 }}
              >
                {status.msg}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {hasResultado && (
          <div className="section">
            <div className="section-header">
              <h2>3. Resultado da Conciliação</h2>
              <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>
                {resumo.total} registro(s)
              </span>
            </div>
            <div className="section-body">
              {/* Warning note */}
              <div className="instrucoes" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#78350f' }}>
                <strong>Atenção:</strong> O número do contrato nos movimentos da folha pode estar truncado (8 últimos dígitos). A conciliação tenta casar pelo sufixo do contrato e pelo nome do empregado. Verifique manualmente os casos marcados como "Parcial" ou "Não Descontado".
              </div>

              {/* Table */}
              <div className="table-wrap" style={{ marginBottom: '18px' }}>
                <table className="recon">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Colaborador</th>
                      <th>CPF</th>
                      <th>Nº Contrato<br />(Planilha)</th>
                      <th>Nº Contrato<br />(Movimentos)</th>
                      <th className="right">Parcela<br />(Planilha)</th>
                      <th className="right">Desc.<br />(Movimentos)</th>
                      <th>Status</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoLinhas.map((linha, idx) => (
                      <tr key={idx} className={`status-${linha.status}`}>
                        <td className="center">{linha.codigo || '—'}</td>
                        <td>{linha.nome}</td>
                        <td>{linha.cpf}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {linha.contratoPlan}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {linha.contratoMov || '—'}
                        </td>
                        <td className="right">{BRL(linha.parcela)}</td>
                        <td className="right">
                          <input
                            className="valor-input"
                            type="number"
                            defaultValue={linha.valorMov.toFixed(2)}
                            step="0.01"
                            min="0"
                            style={{ width: '100px' }}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              updateLinha(idx, { valorMov: val })
                            }}
                          />
                        </td>
                        <td>
                          <select
                            className={`status-sel s-${linha.status}`}
                            value={linha.status}
                            onChange={(e) => updateLinha(idx, { status: e.target.value })}
                          >
                            <option value="ok">Desconto Total</option>
                            <option value="parcial">Desconto Parcial</option>
                            <option value="naodesc">Não Descontado</option>
                            <option value="demitido">Demitido</option>
                            <option value="afastado">Afastado</option>
                            <option value="outro">Outro</option>
                          </select>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                          {linha.obs}
                          {linha.editadoManualmente && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginLeft: '4px',
                                fontSize: '10px',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              editado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumo cards */}
              <div className="resumo">
                <div className="resumo-card ok">
                  <div className="lbl">Desconto Total</div>
                  <div className="val">{resumo.ok}</div>
                </div>
                <div className="resumo-card parcial">
                  <div className="lbl">Parcial</div>
                  <div className="val">{resumo.parcial}</div>
                </div>
                <div className="resumo-card naodesc">
                  <div className="lbl">Não Descontado</div>
                  <div className="val">{resumo.naodesc}</div>
                </div>
                <div className="resumo-card demitido">
                  <div className="lbl">Demitido</div>
                  <div className="val">{resumo.demitido}</div>
                </div>
                <div className="resumo-card afastado">
                  <div className="lbl">Afastado</div>
                  <div className="val">{resumo.afastado}</div>
                </div>
                <div className="resumo-card outro">
                  <div className="lbl">Outro</div>
                  <div className="val">{resumo.outro}</div>
                </div>
                <div className="resumo-card total">
                  <div className="lbl">Total</div>
                  <div className="val">{resumo.total}</div>
                </div>
              </div>

              {/* Totalizadores */}
              <div className="totalizadores">
                <div className="tot-card tot-descontado">
                  <div className="tot-lbl">Total Descontado dos Empregados</div>
                  <div className="tot-val">{BRL(totalDescontado)}</div>
                  <div className="tot-desc">
                    Soma dos descontos encontrados nos movimentos (total + parcial)
                  </div>
                </div>
                <div className="tot-card tot-parciais">
                  <div className="tot-lbl">Total das Diferenças Não Descontadas</div>
                  <div className="tot-val">{BRL(totalDiferencas)}</div>
                  <div className="tot-desc">
                    Soma de parcelas não descontadas + diferenças parciais
                  </div>
                </div>
              </div>

              {/* FGTS Banner */}
              <div className="fgts-banner">
                <div>
                  <div className="lbl">Valor a Recolher na Guia do FGTS Digital</div>
                  <div className="val">{BRL(totalFGTS)}</div>
                </div>
                <div className="desc">
                  Calculado como 8% sobre as diferenças não descontadas ({BRL(totalDiferencas)}).
                  Este valor deve ser gerado como guia avulsa no FGTS Digital para os contratos de
                  Crédito do Trabalhador não deduzidos da folha.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="info-irrf" style={{ marginTop: '20px' }}>
          <strong>ℹ️ Como funciona:</strong> A ferramenta cruza os contratos da planilha de Crédito do Trabalhador (eSocial) com os descontos lançados nos movimentos da folha de pagamento. Quando o desconto não é encontrado ou é parcial, o valor é apurado para geração da guia do FGTS Digital. Os status podem ser editados manualmente caso necessário.
        </div>
      </div>
    </div>
  )
}
