import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CustoEmpregadoDomestico from './pages/CustoEmpregadoDomestico'
import CalculadoraHoras from './pages/CalculadoraHoras'
import CalculadoraIRRF from './pages/CalculadoraIRRF'
import CalculadoraJornada from './pages/CalculadoraJornada'
import CustoEmpregado from './pages/CustoEmpregado'
import ConciliadorCredito from './pages/ConciliadorCredito'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/custo-empregado-domestico" element={<CustoEmpregadoDomestico />} />
        <Route path="/calculadora-horas" element={<CalculadoraHoras />} />
        <Route path="/calculadora-irrf" element={<CalculadoraIRRF />} />
        <Route path="/calculadora-jornada" element={<CalculadoraJornada />} />
        <Route path="/custo-empregado" element={<CustoEmpregado />} />
        <Route path="/conciliador-credito" element={<ConciliadorCredito />} />
      </Routes>
    </BrowserRouter>
  )
}
