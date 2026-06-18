import { useNavigate } from 'react-router-dom'

interface Tool {
  title: string
  desc: string
  route: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
}

function HouseIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  )
}

function ClockIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  )
}

function DocIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  )
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function PeopleIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

const tools: Tool[] = [
  {
    title: 'Custo Empregado Doméstico',
    desc: 'Calcula encargos do Simples Doméstico: INSS, FGTS, GILRAT, provisões e salário líquido.',
    route: '/custo-empregado-domestico',
    iconBg: '#ecfdf5',
    iconColor: '#16a34a',
    icon: <HouseIcon color="#16a34a" />,
  },
  {
    title: 'Calculadora de Horas',
    desc: 'Operações matemáticas com horas no formato HH:MM:SS (soma, subtração, multiplicação e divisão).',
    route: '/calculadora-horas',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    icon: <ClockIcon color="#2563eb" />,
  },
  {
    title: 'Calculadora IRRF 2026',
    desc: 'IRRF com Lei nº 15.270/2025. Compara deduções legais × desconto simplificado automaticamente.',
    route: '/calculadora-irrf',
    iconBg: '#fef9c3',
    iconColor: '#ca8a04',
    icon: <DocIcon color="#ca8a04" />,
  },
  {
    title: 'Calculadora de Jornada',
    desc: 'Calcula horas normais e noturnas por dia da semana com totais semanais e mensais (CLT).',
    route: '/calculadora-jornada',
    iconBg: '#f5f3ff',
    iconColor: '#9333ea',
    icon: <CalendarIcon color="#9333ea" />,
  },
  {
    title: 'Custo de Empregado (CLT)',
    desc: 'Encargos patronais completos: CPP, GILRAT, Sistema S, FGTS, provisões e benefícios.',
    route: '/custo-empregado',
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    icon: <PeopleIcon color="#ea580c" />,
  },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <div className="card">
        <div className="dashboard-header">
          <div className="dashboard-header-inner">
            <div className="dashboard-logo">DP</div>
            <div>
              <div className="dashboard-title">Automações DP</div>
              <div className="dashboard-subtitle">Departamento Pessoal — Ferramentas Integradas</div>
            </div>
          </div>
        </div>

        <p style={{ color: 'var(--ink-muted)', fontSize: '14px', marginBottom: '8px' }}>
          Selecione uma ferramenta para começar. Todas as tabelas tributárias estão atualizadas para 2026, incluindo a Lei nº 15.270/2025.
        </p>

        <div className="dashboard-grid">
          {tools.map((tool) => (
            <div
              key={tool.route}
              className="tool-card"
              onClick={() => navigate(tool.route)}
            >
              <div
                className="tool-card-icon"
                style={{ background: tool.iconBg }}
              >
                {tool.icon}
              </div>
              <div className="tool-card-title">{tool.title}</div>
              <div className="tool-card-desc">{tool.desc}</div>
              <button
                className="tool-card-btn"
                onClick={(e) => { e.stopPropagation(); navigate(tool.route) }}
              >
                Abrir →
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', padding: '14px 18px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <p style={{ fontSize: '12px', color: 'var(--ink-muted)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--ink)' }}>Tabelas 2026:</strong> INSS progressivo (LC 150/2015 e Lei 8.212/91) — teto R$ 8.475,55 | IRRF com redutor gradual da Lei 15.270/2025 — isenção até R$ 5.000,00 | Salário mínimo: R$ 1.621,00
          </p>
        </div>
      </div>
    </div>
  )
}
