// ============================================================
// AdminDashboard.jsx — painel de controle do admin (MEDICO)
// ============================================================
import { useState, useEffect } from "react";

const API = "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("token");
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

function calcularTempoRestante(dataInicio) {
  const inicio = new Date(dataInicio.replace(" ", "T"));
  const fim = new Date(inicio.getTime() + 50 * 60 * 1000);
  const agora = new Date();
  const diffMs = fim - agora;
  if (diffMs <= 0) return null;
  const minutos = Math.floor(diffMs / 60000);
  const segundos = Math.floor((diffMs % 60000) / 1000);
  return { minutos, segundos, percentual: Math.max(0, (diffMs / (50 * 60 * 1000)) * 100) };
}

function estaEmAtendimento(dataInicio) {
  const inicio = new Date(dataInicio.replace(" ", "T"));
  const fim = new Date(inicio.getTime() + 50 * 60 * 1000);
  const agora = new Date();
  return agora >= inicio && agora <= fim;
}

export default function AdminDashboard({ usuario, logout }) {
  const [aba, setAba] = useState("atendimentos");
  const [estagiarios, setEstagiarios] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [agora, setAgora] = useState(new Date());
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  // Estados do relatório
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  const [relatorio, setRelatorio] = useState(null);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);

  // Relógio para o cronômetro
  useEffect(() => {
    const interval = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    carregarTudo();
  }, []);

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

  async function deletarEstagiario(id) {
    if (!confirm("Tem certeza que deseja deletar este estagiário?")) return;
    try {
      const res = await fetch(`${API}/estagiarios/${id}`, { method: "DELETE", headers: headers() });
      const data = await res.json();
      if (res.ok) { setMsg("Estagiário deletado com sucesso!"); carregarTudo(); }
      else setErro(data.error || "Erro ao deletar.");
    } catch { setErro("Erro ao conectar com o servidor."); }
  }

  function iniciarEdicao(est) {
    setEditando(est.id);
    setFormEdit({ nome: est.nome, email: est.email || "", telefone: est.telefone || "" });
  }

  async function salvarEdicao(id) {
    try {
      const res = await fetch(`${API}/estagiarios/${id}`, { method: "PUT", headers: headers(), body: JSON.stringify(formEdit) });
      const data = await res.json();
      if (res.ok) { setMsg("Estagiário atualizado!"); setEditando(null); carregarTudo(); }
      else setErro(data.error || "Erro ao atualizar.");
    } catch { setErro("Erro ao conectar com o servidor."); }
  }

  // Busca o relatório do mês selecionado
  async function buscarRelatorio() {
    setCarregandoRelatorio(true);
    setRelatorio(null);
    try {
      const res = await fetch(`${API}/relatorio?mes=${mesSelecionado}`, { headers: headers() });
      const data = await res.json();
      if (res.ok) setRelatorio(data);
      else setErro(data.error || "Erro ao buscar relatório.");
    } catch { setErro("Erro ao conectar com o servidor."); }
    setCarregandoRelatorio(false);
  }

  // Formata 'YYYY-MM' para ex: 'Maio 2024'
  function formatarMes(mesStr) {
    const [ano, mes] = mesStr.split("-");
    const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return `${nomes[parseInt(mes) - 1]} ${ano}`;
  }

  const emAtendimento = agendamentos.filter(
    (a) => a.status === "AGENDADO" && a.sessao_iniciada && estaEmAtendimento(a.data_inicio)
  );

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
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Painel Administrativo</h1>
          <p style={s.subtitulo}>Bem-vindo, <strong>{usuario?.nome}</strong></p>
        </div>
        <button onClick={logout} style={s.btnSair}>Sair</button>
      </div>

      {msg && <div style={s.msgSucesso}>{msg} <button onClick={() => setMsg("")} style={s.fechar}>×</button></div>}
      {erro && <div style={s.msgErro}>{erro} <button onClick={() => setErro("")} style={s.fechar}>×</button></div>}

      <div style={s.abas}>
        {[
          { id: "atendimentos", label: "🟢 Ao Vivo" },
          { id: "estagiarios", label: "👤 Estagiários" },
          { id: "pacientes", label: "🧑‍⚕️ Pacientes" },
          { id: "agendamentos", label: "📅 Agendamentos" },
          { id: "relatorio", label: "📊 Relatório" },
        ].map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{ ...s.aba, ...(aba === a.id ? s.abaAtiva : {}) }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ABA AO VIVO */}
      {aba === "atendimentos" && (
        <div>
          <h2 style={s.secTitulo}>Em Atendimento Agora</h2>
          {emAtendimento.length === 0 ? (
            <div style={s.vazio}>Nenhuma sessão em andamento no momento.</div>
          ) : (
            emAtendimento.map((ag) => {
              const tempo = calcularTempoRestante(ag.data_inicio);
              return (
                <div key={ag.id} style={s.cardAtendimento}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: 16 }}>🧑‍⚕️ {ag.nomePaciente}</p>
                    <p style={{ margin: "4px 0", color: "#555" }}>Estagiário: {ag.nomeEstagiario} | Sala {ag.sala_id}</p>
                    <p style={{ margin: 0, color: "#888", fontSize: 13 }}>Início: {ag.data_inicio}</p>
                  </div>
                  <div style={{ textAlign: "center", minWidth: 130 }}>
                    {tempo ? (
                      <>
                        <div style={{ fontSize: 34, fontWeight: "bold", color: tempo.minutos < 10 ? "#e74c3c" : "#2ecc71", fontVariantNumeric: "tabular-nums" }}>
                          {tempo.minutos}:{String(tempo.segundos).padStart(2, "0")}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>min restantes</div>
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

      {/* ABA ESTAGIÁRIOS */}
      {aba === "estagiarios" && (
        <div>
          <h2 style={s.secTitulo}>Estagiários ({estagiarios.length})</h2>
          {estagiarios.map((est) => (
            <div key={est.id} style={s.card}>
              {editando === est.id ? (
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={s.cardNome}>{est.nome}</p>
                    <p style={s.cardInfo}>RA: {est.ra} | {est.email} | {est.telefone}</p>
                    <span style={{ ...s.badge, background: est.perfil === "MEDICO" ? "#007bff" : "#28a745" }}>{est.perfil}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => iniciarEdicao(est)} style={s.btnEditar}>Editar</button>
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

      {/* ABA PACIENTES */}
      {aba === "pacientes" && (
        <div>
          <h2 style={s.secTitulo}>Todos os Pacientes ({pacientes.length})</h2>
          {pacientes.map((p) => {
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

      {/* ABA AGENDAMENTOS */}
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
                      <span style={{ ...s.badge, background: a.status === "AGENDADO" ? "#28a745" : "#dc3545" }}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA RELATÓRIO */}
      {aba === "relatorio" && (
        <div>
          <h2 style={s.secTitulo}>Relatório Mensal</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
            />
            <button onClick={buscarRelatorio} disabled={carregandoRelatorio}
              style={{ padding: "8px 20px", background: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
              {carregandoRelatorio ? "Carregando..." : "Gerar Relatório"}
            </button>
            {relatorio && (
              <button onClick={() => window.print()}
                style={{ padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                🖨️ Imprimir
              </button>
            )}
          </div>

          {relatorio && (
            <div>
              <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Atendimentos — {formatarMes(relatorio.mes)}</h3>
                <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
                  Total geral de sessões no mês: <strong>{relatorio.total_geral}</strong>
                </p>
              </div>

              {relatorio.estagiarios.length === 0 ? (
                <div style={s.vazio}>Nenhum agendamento encontrado para {formatarMes(relatorio.mes)}.</div>
              ) : (
                relatorio.estagiarios.map((est) => (
                  <div key={est.id} style={{ border: "1px solid #dee2e6", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#e9f0ff", padding: "12px 16px" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: "bold", fontSize: 15 }}>👤 {est.nome}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>
                          {est.total_sessoes} agendada(s) &nbsp;|&nbsp;
                          <span style={{ color: "#28a745" }}>{est.total_iniciadas} iniciada(s)</span> &nbsp;|&nbsp;
                          <span style={{ color: "#dc3545" }}>{est.total_sessoes - est.total_iniciadas} não iniciada(s)</span>
                        </p>
                      </div>
                      <span style={{ ...s.badge, background: "#007bff", fontSize: 12, padding: "4px 10px" }}>
                        {est.pacientes.length} paciente(s)
                      </span>
                    </div>
                    <table style={s.tabela}>
                      <thead>
                        <tr>
                          {["Paciente", "Agendadas", "Iniciadas", "Não Iniciadas"].map((h) => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {est.pacientes.map((p) => (
                          <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                            <td style={s.td}>{p.nome}</td>
                            <td style={{ ...s.td, textAlign: "center" }}>{p.total_sessoes}</td>
                            <td style={{ ...s.td, textAlign: "center", color: "#28a745" }}>{p.sessoes_iniciadas}</td>
                            <td style={{ ...s.td, textAlign: "center", color: p.total_sessoes - p.sessoes_iniciadas > 0 ? "#dc3545" : "#28a745" }}>
                              {p.total_sessoes - p.sessoes_iniciadas}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
