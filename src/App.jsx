import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "./api";

import Login from "./Login";
import Dashboard from "./Dashboard";
import AdminDashboard from "./AdminDashboard";
import Pacientes from "./Pacientes";
import Agendamentos from "./Agendamentos";
import CadastroEstagiario from "./cadastro-estagiario";

function RotaProtegida({ usuario, children }) {
  if (!usuario) return <Navigate to="/" replace />;
  return children;
}

function RotaAdmin({ usuario, children }) {
  if (!usuario) return <Navigate to="/" replace />;
  if (usuario.perfil !== "MEDICO") return <Navigate to="/Dashboard" replace />;
  return children;
}

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function App() {
  const [pacientes, setPacientes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [limites, setLimites] = useState(null);

  const [usuarioLogado, setUsuarioLogado] = useState(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const decoded = decodeToken(token);
    if (!decoded || decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return null;
    }
    return { id: decoded.id, nome: decoded.nome, perfil: decoded.perfil };
  });

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

  useEffect(() => {
    if (usuarioLogado && usuarioLogado.perfil !== "MEDICO") carregarDados();
  }, [usuarioLogado]);

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
        <Route path="/" element={<Login setUsuarioLogado={setUsuarioLogado} />} />
        <Route path="/cadastro-estagiario" element={<CadastroEstagiario />} />

        <Route
          path="/admin"
          element={
            <RotaAdmin usuario={usuarioLogado}>
              <AdminDashboard usuario={usuarioLogado} logout={logout} />
            </RotaAdmin>
          }
        />

        <Route
          path="/Dashboard"
          element={
            <RotaProtegida usuario={usuarioLogado}>
              <Dashboard usuario={usuarioLogado} logout={logout} limites={limites} pacientes={pacientes} />
            </RotaProtegida>
          }
        />
        <Route
          path="/Pacientes"
          element={
            <RotaProtegida usuario={usuarioLogado}>
              <Pacientes atualizarLista={carregarDados} usuario={usuarioLogado} pacientes={pacientes} limites={limites} />
            </RotaProtegida>
          }
        />
        <Route
          path="/Agendamentos"
          element={
            <RotaProtegida usuario={usuarioLogado}>
              <Agendamentos pacientes={pacientes} agendamentos={agendamentos} atualizarLista={carregarDados} usuario={usuarioLogado} limites={limites} />
            </RotaProtegida>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
  