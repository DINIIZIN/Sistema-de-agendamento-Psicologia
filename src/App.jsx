// ============================================================
// App.jsx — raiz da aplicação e configuração de rotas
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "./api";

// Importação de todos os componentes/páginas
import Login from "./Login";
import Dashboard from "./Dashboard";
import AdminDashboard from "./AdminDashboard";
import Pacientes from "./Pacientes";
import Agendamentos from "./Agendamentos";
import CadastroEstagiario from "./cadastro-estagiario";

// ============================================================
// COMPONENTES DE PROTEÇÃO DE ROTA
// ============================================================

// RotaProtegida: redireciona para o login se o usuário não estiver logado
function RotaProtegida({ usuario, children }) {
  if (!usuario) return <Navigate to="/" replace />;
  return children;
}

// RotaAdmin: só permite acesso se o perfil for MEDICO
// Se for estagiário logado, redireciona para o Dashboard deles
function RotaAdmin({ usuario, children }) {
  if (!usuario) return <Navigate to="/" replace />;
  if (usuario.perfil !== "MEDICO") return <Navigate to="/Dashboard" replace />;
  return children;
}

// ============================================================
// FUNÇÃO AUXILIAR: decodifica o payload do token JWT
// O payload é a segunda parte do token (separado por '.'), codificado em Base64
// ============================================================
function decodeToken(token) {
  try {
    const payload = token.split(".")[1]; // Pega a parte do meio do JWT
    return JSON.parse(atob(payload));    // Decodifica de Base64 para objeto JS
  } catch {
    return null; // Retorna null se o token for inválido
  }
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
function App() {
  // Estados globais compartilhados entre as páginas do estagiário
  const [pacientes, setPacientes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [limites, setLimites] = useState(null);

  // Inicializa o usuário logado a partir do token salvo no localStorage
  // Isso mantém o usuário logado mesmo após recarregar a página
  const [usuarioLogado, setUsuarioLogado] = useState(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const decoded = decodeToken(token);

    // Verifica se o token ainda é válido (exp está em segundos, Date.now() em ms)
    if (!decoded || decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem("token"); // Remove token expirado
      return null;
    }

    return { id: decoded.id, nome: decoded.nome, perfil: decoded.perfil };
  });

  // Carrega os dados do estagiário (pacientes, agendamentos e limites) em paralelo
  const carregarDados = async () => {
    try {
      const [dataPacientes, dataAgendamentos, dataLimites] = await Promise.all([
        api.get("/pacientes"),
        api.get("/agendamentos"),
        api.get("/meus-limites"),
      ]);
      setPacientes(dataPacientes);
      setAgendamentos(dataAgendamentos);
      setLimites(dataLimites);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    }
  };

  // Carrega os dados sempre que o usuário logar (mas não para o admin, que tem seu próprio carregamento)
  useEffect(() => {
    if (usuarioLogado && usuarioLogado.perfil !== "MEDICO") carregarDados();
  }, [usuarioLogado]);

  // Limpa todos os dados ao fazer logout e remove o token do localStorage
  function logout() {
    localStorage.removeItem("token");
    setUsuarioLogado(null);
    setPacientes([]);
    setAgendamentos([]);
    setLimites(null);
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Página de login — pública */}
        <Route path="/" element={<Login setUsuarioLogado={setUsuarioLogado} />} />

        {/* Cadastro de estagiário — público */}
        <Route path="/cadastro-estagiario" element={<CadastroEstagiario />} />

        {/* Painel do admin — só MEDICO acessa */}
        <Route
          path="/admin"
          element={
            <RotaAdmin usuario={usuarioLogado}>
              <AdminDashboard usuario={usuarioLogado} logout={logout} />
            </RotaAdmin>
          }
        />

        {/* Dashboard do estagiário */}
        <Route
          path="/Dashboard"
          element={
            <RotaProtegida usuario={usuarioLogado}>
              <Dashboard usuario={usuarioLogado} logout={logout} limites={limites} pacientes={pacientes} />
            </RotaProtegida>
          }
        />

        {/* Página de pacientes do estagiário */}
        <Route
          path="/Pacientes"
          element={
            <RotaProtegida usuario={usuarioLogado}>
              <Pacientes atualizarLista={carregarDados} usuario={usuarioLogado} pacientes={pacientes} limites={limites} />
            </RotaProtegida>
          }
        />

        {/* Página de agendamentos do estagiário */}
        <Route
          path="/Agendamentos"
          element={
            <RotaProtegida usuario={usuarioLogado}>
              <Agendamentos pacientes={pacientes} agendamentos={agendamentos} atualizarLista={carregarDados} usuario={usuarioLogado} limites={limites} />
            </RotaProtegida>
          }
        />

        {/* Qualquer rota não mapeada redireciona para o login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
