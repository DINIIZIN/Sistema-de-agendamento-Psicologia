import { useNavigate } from "react-router-dom";

function Dashboard({ usuario, logout, limites, pacientes }) {
  const navigate = useNavigate();

  const pacientesRestantes = limites ? limites.maxPacientes - limites.totalPacientes : null;

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
      <h1>Software de Agendamento</h1>

      {usuario && (
        <p>Bem-vindo, <strong>{usuario.nome}</strong>! ({usuario.perfil})</p>
      )}

      {limites && usuario?.perfil !== 'MEDICO' && (
        <div style={{ background: "#f0f4ff", border: "1px solid #c0d0ff", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 10px" }}>Seus Limites</h3>
          <p style={{ margin: "4px 0" }}>
            👥 Pacientes: <strong>{limites.totalPacientes} / {limites.maxPacientes}</strong>
            {pacientesRestantes === 0 && <span style={{ color: "red", marginLeft: 8 }}>Limite atingido</span>}
          </p>
          {limites.sessoesPorPaciente.map(s => {
            const pac = pacientes ? pacientes.find(p => p.id === s.paciente_id) : null;
            return (
              <p key={s.paciente_id} style={{ margin: "4px 0", fontSize: "0.9em" }}>
                📅 {pac ? pac.nome : `Paciente #${s.paciente_id}`}: <strong>{s.sessoes} / {limites.maxSessoes}</strong> sessões
                {s.sessoes >= limites.maxSessoes && <span style={{ color: "red", marginLeft: 8 }}>Limite atingido</span>}
              </p>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => navigate("/Agendamentos")} style={{ padding: 14, fontSize: 16 }}>📅 Agendamentos</button>
        <button onClick={() => navigate("/Pacientes")} style={{ padding: 14, fontSize: 16 }}>👥 Pacientes</button>
        <button onClick={logout} style={{ padding: 14, fontSize: 16, background: "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          Sair
        </button>
      </div>
    </div>
  );
}

export default Dashboard;