import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// Helper functions
function formatDigitsToTimeStr(digits: string): string {
  const d = digits.padStart(6, '0')
  const hh = d.slice(0, d.length - 4)
  const mm = d.slice(-4, -2)
  const ss = d.slice(-2)
  const hhDisplay = parseInt(hh) || 0
  return `${hhDisplay.toString().padStart(2, '0')}:${mm}:${ss}`
}

function timeStrToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

function secondsToDigits(totalSeconds: number): string {
  const absSeconds = Math.abs(totalSeconds)
  const hh = Math.floor(absSeconds / 3600)
  const mm = Math.floor((absSeconds % 3600) / 60)
  const ss = absSeconds % 60
  return `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}${ss.toString().padStart(2, '0')}`
}

function formatSecondsToDisplay(totalSeconds: number): string {
  const isNeg = totalSeconds < 0
  const abs = Math.abs(totalSeconds)
  const hh = Math.floor(abs / 3600)
  const mm = Math.floor((abs % 3600) / 60)
  const ss = abs % 60
  const str = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
  return isNeg ? '-' + str : str
}

export default function CalculadoraHoras() {
  const navigate = useNavigate()

  const [inputDigits, setInputDigits] = useState('')
  const [previousSeconds, setPreviousSeconds] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waitingForNewValue, setWaitingForNewValue] = useState(false)
  const [memory, setMemory] = useState(0)
  const [expressionDisplay, setExpressionDisplay] = useState('')
  const [displayValue, setDisplayValue] = useState('00:00:00')

  function getCurrentSeconds(): number {
    const timeStr = formatDigitsToTimeStr(inputDigits)
    return timeStrToSeconds(timeStr)
  }

  const updateDisplay = useCallback((digits: string) => {
    setDisplayValue(formatDigitsToTimeStr(digits || '0'))
  }, [])

  function handleDigit(d: string) {
    if (waitingForNewValue) {
      const newDigits = d
      setInputDigits(newDigits)
      setWaitingForNewValue(false)
      updateDisplay(newDigits)
    } else {
      if (inputDigits.length >= 6) return
      const newDigits = inputDigits + d
      setInputDigits(newDigits)
      updateDisplay(newDigits)
    }
  }

  function handleOperator(op: string) {
    const currentSeconds = getCurrentSeconds()

    if (previousSeconds !== null && operator && !waitingForNewValue) {
      const result = calculate(previousSeconds, currentSeconds, operator)
      const newDigits = secondsToDigits(Math.abs(result))
      setDisplayValue(formatSecondsToDisplay(result))
      setInputDigits(newDigits)
      setExpressionDisplay(`${formatSecondsToDisplay(result)} ${op}`)
      setPreviousSeconds(result)
    } else {
      setExpressionDisplay(`${formatSecondsToDisplay(currentSeconds)} ${op}`)
      setPreviousSeconds(currentSeconds)
    }
    setOperator(op)
    setWaitingForNewValue(true)
  }

  function calculate(a: number, b: number, op: string): number {
    switch (op) {
      case '+': return a + b
      case '−': return a - b
      case '×': {
        // b is treated as a multiplier (not time), convert back
        const timeStr = formatDigitsToTimeStr(secondsToDigits(b))
        const parts = timeStr.split(':').map(Number)
        const multiplier = parts[0] + parts[1] / 60 + parts[2] / 3600
        return Math.round(a * multiplier)
      }
      case '÷': {
        if (b === 0) return 0
        const timeStr = formatDigitsToTimeStr(secondsToDigits(b))
        const parts = timeStr.split(':').map(Number)
        const divisor = parts[0] + parts[1] / 60 + parts[2] / 3600
        if (divisor === 0) return 0
        return Math.round(a / divisor)
      }
      default: return b
    }
  }

  function handleEquals() {
    if (previousSeconds === null || !operator) return
    const currentSeconds = getCurrentSeconds()
    const result = calculate(previousSeconds, currentSeconds, operator)
    const newDigits = secondsToDigits(Math.abs(result))
    setDisplayValue(formatSecondsToDisplay(result))
    setInputDigits(newDigits)
    setExpressionDisplay(`${expressionDisplay} ${formatSecondsToDisplay(currentSeconds)} =`)
    setPreviousSeconds(null)
    setOperator(null)
    setWaitingForNewValue(true)
  }

  function handleClear() {
    setInputDigits('')
    setPreviousSeconds(null)
    setOperator(null)
    setWaitingForNewValue(false)
    setExpressionDisplay('')
    setDisplayValue('00:00:00')
  }

  function handleBackspace() {
    if (waitingForNewValue) return
    const newDigits = inputDigits.slice(0, -1)
    setInputDigits(newDigits)
    updateDisplay(newDigits)
  }

  function handleMemorySave() {
    setMemory(getCurrentSeconds())
  }

  function handleMemoryRecall() {
    const newDigits = secondsToDigits(Math.abs(memory))
    setInputDigits(newDigits)
    setDisplayValue(formatSecondsToDisplay(memory))
    setWaitingForNewValue(false)
  }

  function handleMemoryAdd() {
    setMemory(prev => prev + getCurrentSeconds())
  }

  function handleMemorySubtract() {
    setMemory(prev => prev - getCurrentSeconds())
  }

  function handleMemoryClear() {
    setMemory(0)
  }

  // Keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key)
      else if (e.key === '+') handleOperator('+')
      else if (e.key === '-') handleOperator('−')
      else if (e.key === '*') handleOperator('×')
      else if (e.key === '/') { e.preventDefault(); handleOperator('÷') }
      else if (e.key === 'Enter' || e.key === '=') handleEquals()
      else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') handleClear()
      else if (e.key === 'Backspace') handleBackspace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const buttons = [
    { label: 'C', action: handleClear, cls: 'clr' },
    { label: '⌫', action: handleBackspace, cls: 'back' },
    { label: '÷', action: () => handleOperator('÷'), cls: 'op' },
    { label: '×', action: () => handleOperator('×'), cls: 'op' },
    { label: '7', action: () => handleDigit('7'), cls: '' },
    { label: '8', action: () => handleDigit('8'), cls: '' },
    { label: '9', action: () => handleDigit('9'), cls: '' },
    { label: '−', action: () => handleOperator('−'), cls: 'op' },
    { label: '4', action: () => handleDigit('4'), cls: '' },
    { label: '5', action: () => handleDigit('5'), cls: '' },
    { label: '6', action: () => handleDigit('6'), cls: '' },
    { label: '+', action: () => handleOperator('+'), cls: 'op' },
    { label: '1', action: () => handleDigit('1'), cls: '' },
    { label: '2', action: () => handleDigit('2'), cls: '' },
    { label: '3', action: () => handleDigit('3'), cls: '' },
    { label: '=', action: handleEquals, cls: 'eq' },
    { label: '0', action: () => handleDigit('0'), cls: '' },
    { label: '00', action: () => { handleDigit('0'); handleDigit('0') }, cls: '' },
  ]

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 600 }}>
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Painel DP
        </button>

        <h1 className="title">Calculadora de Horas</h1>
        <p style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: '13px', marginBottom: '24px' }}>
          Digite no formato HHMMSS (ex: 010330 = 01:03:30). Use +, −, ×, ÷ para operar.
        </p>

        <div className="calc-wrapper">
          <div className="calc-widget">
            <div className="calc-title-bar">
              <span>Calc Horas — HH:MM:SS</span>
              <span style={{ color: memory !== 0 ? '#22c55e' : '#4b5563' }}>
                {memory !== 0 ? `M: ${formatSecondsToDisplay(memory)}` : 'M: —'}
              </span>
            </div>

            <div className="calc-display">
              <div className="calc-expr">{expressionDisplay || ' '}</div>
              <div className="calc-main">{displayValue}</div>
            </div>

            <div className="calc-memory-row">
              <button className="calc-mem-btn" onClick={handleMemoryClear} title="Memory Clear">MC</button>
              <button className="calc-mem-btn" onClick={handleMemoryRecall} title="Memory Recall">MR</button>
              <button className="calc-mem-btn" onClick={handleMemoryAdd} title="Memory Add">M+</button>
              <button className="calc-mem-btn" onClick={handleMemorySubtract} title="Memory Subtract">M−</button>
              <button className="calc-mem-btn" onClick={handleMemorySave} title="Memory Save">MS</button>
            </div>

            <div className="calc-grid">
              {buttons.map((btn, i) => (
                <button
                  key={i}
                  className={`calc-btn ${btn.cls}`}
                  onClick={btn.action}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="info-irrf" style={{ marginTop: '24px' }}>
          <strong>Modo de uso:</strong> Digite os dígitos direto (sem separadores). Exemplo: para 2h30min15s, digite <code>023015</code> → aparece <strong>02:30:15</strong>. Use os operadores para somar, subtrair, multiplicar ou dividir durações. Atalhos: C=Limpar, Backspace=Apagar, Enter=Calcular.
        </div>
      </div>
    </div>
  )
}
