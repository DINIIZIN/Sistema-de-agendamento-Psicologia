// ============================================================
// AdminDashboard.jsx — painel de controle do admin (MEDICO)
// ============================================================
// Contém 4 abas:
//   🟢 Ao Vivo     — sessões em andamento agora com cronômetro regressivo
//   👤 Estagiários — lista com edição e exclusão
//   🧑‍⚕️ Pacientes   — todos os pacientes do sistema
//   📅 Agendamentos — tabela completa de todos os agendamentos
import { useState, useEffect } from "react";

const API = "http://localhost:3001/api";

// Retorna o token JWT salvo no login
function getToken() {
  return localStorage.getItem("token");
}

// Monta o header com autenticação JWT
function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ============================================================
// Calcula o tempo restante de uma sessão de 50 minutos
// Retorna { minutos, segundos, percentual } ou null se já terminou
// ============================================================
function calcularTempoRestante(dataInicio) {
  const inicio = new Date(dataInicio.replace(" ", "T")); // Converte '2024-05-05 14:30' para Date
  const fim = new Date(inicio.getTime() + 50 * 60 * 1000); // Adiciona 50 minutos
  const agora = new Date();
  const diffMs = fim - agora; // Milissegundos restantes
  if (diffMs <= 0) return null; // Sessão já encerrada
  const minutos = Math.floor(diffMs / 60000);
  const segundos = Math.floor((diffMs % 60000) / 1000);
  return {
    minutos,
    segundos,
    percentual: Math.max(0, (diffMs / (50 * 60 * 1000)) * 100) // % do tempo restante para a barra
  };
}

// Verifica se uma sessão está acontecendo agora (entre data_inicio e data_inicio + 50min)
function estaEmAtendimento(dataInicio) {
  const inicio = new Date(dataInicio.replace(" ", "T"));
  const fim = new Date(inicio.getTime() + 50 * 60 * 1000);
  const agora = new Date();
  return agora >= inicio && agora <= fim;
}

export default function AdminDashboard({ usuario, logout }) {
  // Aba ativa no momento
  const [aba, setAba] = useState("atendimentos");

  // Dados carregados da API
  const [estagiarios, setEstagiarios] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);

  // Relógio atualizado a cada segundo (para o cronômetro ao vivo)
  const [agora, setAgora] = useState(new Date());

  // Controle do formulário de edição de estagiário
  const [editando, setEditando] = useState(null); // ID do estagiário sendo editado
  const [formEdit, setFormEdit] = useState({});

  // Mensagens de feedback
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  // Atualiza o relógio a cada 1 segundo para o cronômetro regressivo
  useEffect(() => {
    const interval = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(interval); // Limpa o interval ao desmontar o componente
  }, []);

  // Carrega todos os dados ao montar o componente
  useEffect(() => {
    carregarTudo();
  }, []);

  // Carrega estagiários, pacientes e agendamentos em paralelo
  async function carregarTudo() {
    try {
      const [resE, resP, resA] = await Promise.all([
        fetch(`${API}/estagiarios`, { headers: headers() }),
        fetch(`${API}/pacientes`, { headers: headers() }),
        fetch(`${API}/agendamentos`, { headers: headers() }),
      ]);
      setEstagiarios(await resE.json());
      setPacientes(await resP.json());
      setAgendamentos(await resA.json());
    } catch {
      setErro("Erro ao carregar dados.");
    }
  }

  // Deleta um estagiário após confirmação
  async function deletarEstagiario(id) {
    if (!confirm("Tem certeza que deseja deletar este estagiário?")) return;
    try {
      const res = await fetch(`${API}/estagiarios/${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Estagiário deletado com sucesso!");
        carregarTudo(); // Recarrega a lista atualizada
      } else {
        setErro(data.error || "Erro ao deletar.");
      }
    } catch {
      setErro("Erro ao conectar com o servidor.");
    }
  }

  // Ativa o modo de edição para um estagiário específico
  function iniciarEdicao(est) {
    setEditando(est.id);
    setFormEdit({ nome: est.nome, email: est.email || "", telefone: est.telefone || "" });
  }

  // Salva as alterações feitas no formulário de edição
  async function salvarEdicao(id) {
    try {
      const res = await fetch(`${API}/estagiarios/${id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(formEdit),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Estagiário atualizado!");
        setEditando(null); // Sai do modo de edição
        carregarTudo();
      } else {
        setErro(data.error || "Erro ao atualizar.");
      }
    } catch {
      setErro("Erro ao conectar com o servidor.");
    }
  }

  // Filtra agendamentos que estão acontecendo agora e foram iniciados pelo estagiário
  const emAtendimento = agendamentos.filter(
    (a) => a.status === "AGENDADO" && a.sessao_iniciada && estaEmAtendimento(a.data_inicio)
  );

  // Filtra próximos agendamentos de hoje que ainda não começaram
  const hoje = agora.toISOString().split("T")[0];
  const proximos = agendamentos
    .filter((a) => {
      const dataAg = a.data_inicio.split(" ")[0];
      const inicio = new Date(a.data_inicio.replace(" ", "T"));
      return a.status === "AGENDADO" && dataAg === hoje && inicio > agora;
    })
    .sort((a, b) => new Date(a.data_inicio.replace(" ", "T")) - new Date(b.data_inicio.replace(" ", "T")));

  return (
    <div style={s.container}>

      {/* Cabeçalho com nome do admin e botão de sair */}
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Painel Administrativo</h1>
          <p style={s.subtitulo}>Bem-vindo, <strong>{usuario?.nome}</strong></p>
        </div>
        <button onClick={logout} style={s.btnSair}>Sair</button>
      </div>

      {/* Mensagens de sucesso e erro com botão de fechar */}
      {msg && <div style={s.msgSucesso}>{msg} <button onClick={() => setMsg("")} style={s.fechar}>×</button></div>}
      {erro && <div style={s.msgErro}>{erro} <button onClick={() => setErro("")} style={s.fechar}>×</button></div>}

      {/* Navegação por abas */}
      <div style={s.abas}>
        {[
          { id: "atendimentos", label: "🟢 Ao Vivo" },
          { id: "estagiarios", label: "👤 Estagiários" },
          { id: "pacientes", label: "🧑‍⚕️ Pacientes" },
          { id: "agendamentos", label: "📅 Agendamentos" },
        ].map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{ ...s.aba, ...(aba === a.id ? s.abaAtiva : {}) }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ======================================================
          ABA: AO VIVO — sessões em andamento agora
      ====================================================== */}
      {aba === "atendimentos" && (
        <div>
          <h2 style={s.secTitulo}>Em Atendimento Agora</h2>
          {emAtendimento.length === 0 ? (
            <div style={s.vazio}>Nenhuma sessão em andamento no momento.</div>
          ) : (
            emAtendimento.map((ag) => {
              const tempo = calcularTempoRestante(ag.data_inicio); // Calcula tempo restante
              return (
                <div key={ag.id} style={s.cardAtendimento}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: 16 }}>🧑‍⚕️ {ag.nomePaciente}</p>
                    <p style={{ margin: "4px 0", color: "#555" }}>Estagiário: {ag.nomeEstagiario} | Sala {ag.sala_id}</p>
                    <p style={{ margin: 0, color: "#888", fontSize: 13 }}>Início: {ag.data_inicio}</p>
                  </div>
                  {/* Cronômetro regressivo com barra de progresso */}
                  <div style={{ textAlign: "center", minWidth: 130 }}>
                    {tempo ? (
                      <>
                        {/* Muda para vermelho quando faltam menos de 10 minutos */}
                        <div style={{ fontSize: 34, fontWeight: "bold", color: tempo.minutos < 10 ? "#e74c3c" : "#2ecc71", fontVariantNumeric: "tabular-nums" }}>
                          {tempo.minutos}:{String(tempo.segundos).padStart(2, "0")}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>min restantes</div>
                        {/* Barra de progresso que encolhe com o tempo */}
                        <div style={{ width: "100%", height: 6, background: "#e0e0e0", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${tempo.percentual}%`, background: tempo.minutos < 10 ? "#e74c3c" : "#2ecc71", borderRadius: 3, transition: "width 1s linear" }} />
                        </div>
                      </>
                    ) : (
                      <div style={{ color: "#e74c3c", fontWeight: "bold" }}>Encerrado</div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Próximos agendamentos do dia que ainda não começaram */}
          <h2 style={{ ...s.secTitulo, marginTop: 30 }}>Próximos Hoje</h2>
          {proximos.length === 0 ? (
            <div style={s.vazio}>Sem mais agendamentos para hoje.</div>
          ) : (
            proximos.map((ag) => (
              <div key={ag.id} style={s.cardProximo}>
                <span>🕐 {ag.data_inicio.split(" ")[1]}</span>
                <span>🧑‍⚕️ {ag.nomePaciente}</span>
                <span>👤 {ag.nomeEstagiario}</span>
                <span>🚪 Sala {ag.sala_id}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ======================================================
          ABA: ESTAGIÁRIOS — lista com edição e exclusão
      ====================================================== */}
      {aba === "estagiarios" && (
        <div>
          <h2 style={s.secTitulo}>Estagiários ({estagiarios.length})</h2>
          {estagiarios.map((est) => (
            <div key={est.id} style={s.card}>
              {editando === est.id ? (
                // Formulário de edição inline
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input value={formEdit.nome} onChange={(e) => setFormEdit({ ...formEdit, nome: e.target.value })} placeholder="Nome" style={s.input} />
                  <input value={formEdit.email} onChange={(e) => setFormEdit({ ...formEdit, email: e.target.value })} placeholder="Email" style={s.input} />
                  <input value={formEdit.telefone} onChange={(e) => setFormEdit({ ...formEdit, telefone: e.target.value })} placeholder="Telefone" style={s.input} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => salvarEdicao(est.id)} style={s.btnSalvar}>Salvar</button>
                    <button onClick={() => setEditando(null)} style={s.btnCancelar}>Cancelar</button>
                  </div>
                </div>
              ) : (
                // Exibição normal do estagiário
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={s.cardNome}>{est.nome}</p>
                    <p style={s.cardInfo}>RA: {est.ra} | {est.email} | {est.telefone}</p>
                    {/* Badge colorido: azul para MEDICO, verde para ESTAGIARIO */}
                    <span style={{ ...s.badge, background: est.perfil === "MEDICO" ? "#007bff" : "#28a745" }}>{est.perfil}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => iniciarEdicao(est)} style={s.btnEditar}>Editar</button>
                    {/* Não exibe o botão de deletar para o próprio admin */}
                    {est.perfil !== "MEDICO" && (
                      <button onClick={() => deletarEstagiario(est.id)} style={s.btnDeletar}>Deletar</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ======================================================
          ABA: PACIENTES — todos os pacientes do sistema
      ====================================================== */}
      {aba === "pacientes" && (
        <div>
          <h2 style={s.secTitulo}>Todos os Pacientes ({pacientes.length})</h2>
          {pacientes.map((p) => {
            // Encontra o estagiário responsável pelo paciente
            const est = estagiarios.find((e) => e.id === p.estagiario_id);
            return (
              <div key={p.id} style={s.card}>
                <p style={s.cardNome}>{p.nome}</p>
                <p style={s.cardInfo}>
                  {p.email && `📧 ${p.email}`}{p.telefone && ` | 📞 ${p.telefone}`}
                </p>
                <p style={{ ...s.cardInfo, color: "#007bff" }}>
                  Estagiário: {est ? est.nome : `ID ${p.estagiario_id}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================
          ABA: AGENDAMENTOS — tabela completa
      ====================================================== */}
      {aba === "agendamentos" && (
        <div>
          <h2 style={s.secTitulo}>Todos os Agendamentos ({agendamentos.length})</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={s.tabela}>
              <thead>
                <tr>
                  {["Data/Hora", "Paciente", "Estagiário", "Sala", "Status"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agendamentos.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={s.td}>{a.data_inicio}</td>
                    <td style={s.td}>{a.nomePaciente}</td>
                    <td style={s.td}>{a.nomeEstagiario}</td>
                    <td style={s.td}>Sala {a.sala_id}</td>
                    <td style={s.td}>
                      {/* Badge colorido: verde para AGENDADO, vermelho para CANCELADO */}
                      <span style={{ ...s.badge, background: a.status === "AGENDADO" ? "#28a745" : "#dc3545" }}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ESTILOS — objeto com todos os estilos inline do componente
// ============================================================
const s = {
  container: { maxWidth: 900, margin: "30px auto", padding: "0 20px", fontFamily: "sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #007bff" },
  titulo: { margin: 0, color: "#007bff" },
  subtitulo: { margin: "4px 0 0", color: "#555", fontSize: 14 },
  btnSair: { padding: "8px 16px", background: "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: "pointer" },
  abas: { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  aba: { padding: "10px 16px", border: "1px solid #ddd", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 },
  abaAtiva: { background: "#007bff", color: "white", border: "1px solid #007bff" },
  secTitulo: { fontSize: 18, marginBottom: 12, color: "#333" },
  vazio: { padding: 20, background: "#f8f9fa", borderRadius: 8, color: "#888", textAlign: "center" },
  card: { background: "white", border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
  cardNome: { margin: 0, fontWeight: "bold", fontSize: 15 },
  cardInfo: { margin: "4px 0 0", fontSize: 13, color: "#666" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 4, color: "white", fontSize: 11, marginTop: 4 },
  input: { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 },
  btnEditar: { padding: "6px 12px", background: "#ffc107", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 },
  btnDeletar: { padding: "6px 12px", background: "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 },
  btnSalvar: { padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" },
  btnCancelar: { padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: 4, cursor: "pointer" },
  msgSucesso: { background: "#d4edda", border: "1px solid #c3e6cb", color: "#155724", padding: "10px 16px", borderRadius: 6, marginBottom: 12, display: "flex", justifyContent: "space-between" },
  msgErro: { background: "#f8d7da", border: "1px solid #f5c6cb", color: "#721c24", padding: "10px 16px", borderRadius: 6, marginBottom: 12, display: "flex", justifyContent: "space-between" },
  fechar: { background: "none", border: "none", cursor: "pointer", fontSize: 16, fontWeight: "bold" },
  cardAtendimento: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fff4", border: "1px solid #b7ebc8", borderRadius: 8, padding: 16, marginBottom: 10 },
  cardProximo: { display: "flex", gap: 20, background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 16px", marginBottom: 8, fontSize: 14, flexWrap: "wrap" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { background: "#f8f9fa", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #dee2e6", fontWeight: "600" },
  td: { padding: "10px 12px", verticalAlign: "middle" },
};
