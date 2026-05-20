// ============================================================
// Relatorio.jsx — relatório mensal de agendamentos (admin)
// ============================================================
// Exibe por estagiário:
//   - Total de sessões agendadas no mês
//   - Total de sessões efetivamente iniciadas
//   - Lista de pacientes com contagem individual
// Permite selecionar o mês e imprimir/exportar o relatório
import { useState } from "react";

const API = "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("token");
}

// Formata 'YYYY-MM' para exibição amigável ex: 'Maio 2024'
function formatarMes(mesStr) {
  const [ano, mes] = mesStr.split("-");
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${nomes[parseInt(mes) - 1]} ${ano}`;
}

export default function Relatorio({ onVoltar }) {
  // Mês selecionado no formato YYYY-MM (padrão: mês atual)
  const [mes, setMes] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });

  const [dados, setDados] = useState(null);   // Dados do relatório retornados pela API
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Busca o relatório do mês selecionado
  async function buscarRelatorio() {
    setCarregando(true);
    setErro("");
    setDados(null);
    try {
      const res = await fetch(`${API}/relatorio?mes=${mes}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDados(data);
      } else {
        setErro(data.error || "Erro ao buscar relatório.");
      }
    } catch {
      setErro("Erro ao conectar com o servidor.");
    }
    setCarregando(false);
  }

  // Abre a janela de impressão do navegador
  function imprimir() {
    window.print();
  }

  return (
    <div style={s.container}>

      {/* Cabeçalho com título e botão de voltar */}
      <div style={s.header}>
        <h2 style={s.titulo}>📊 Relatório Mensal</h2>
        <button onClick={onVoltar} style={s.btnVoltar}>← Voltar</button>
      </div>

      {/* Seletor de mês e botão de buscar */}
      <div style={s.filtros}>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          style={s.inputMes}
        />
        <button onClick={buscarRelatorio} disabled={carregando} style={s.btnBuscar}>
          {carregando ? "Carregando..." : "Gerar Relatório"}
        </button>
        {dados && (
          <button onClick={imprimir} style={s.btnImprimir}>🖨️ Imprimir</button>
        )}
      </div>

      {erro && <p style={{ color: "red", marginTop: 12 }}>{erro}</p>}

      {/* Resultado do relatório */}
      {dados && (
        <div id="relatorio-conteudo">

          {/* Cabeçalho do relatório */}
          <div style={s.relatorioHeader}>
            <h3 style={{ margin: 0 }}>Relatório de Atendimentos — {formatarMes(dados.mes)}</h3>
            <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
              Total geral de sessões no mês: <strong>{dados.total_geral}</strong>
            </p>
          </div>

          {/* Sem dados */}
          {dados.estagiarios.length === 0 ? (
            <div style={s.vazio}>Nenhum agendamento encontrado para {formatarMes(dados.mes)}.</div>
          ) : (
            dados.estagiarios.map((est) => (
              <div key={est.id} style={s.cardEstagiario}>

                {/* Cabeçalho do estagiário */}
                <div style={s.estHeader}>
                  <div>
                    <p style={s.estNome}>👤 {est.nome}</p>
                    <p style={s.estInfo}>
                      {est.total_sessoes} sessão(ões) agendada(s) &nbsp;|&nbsp;
                      <span style={{ color: "#28a745" }}>{est.total_iniciadas} iniciada(s)</span> &nbsp;|&nbsp;
                      <span style={{ color: "#dc3545" }}>{est.total_sessoes - est.total_iniciadas} não iniciada(s)</span>
                    </p>
                  </div>
                  {/* Badge com total de pacientes */}
                  <span style={s.badge}>{est.pacientes.length} paciente(s)</span>
                </div>

                {/* Tabela de pacientes do estagiário */}
                <table style={s.tabela}>
                  <thead>
                    <tr>
                      <th style={s.th}>Paciente</th>
                      <th style={s.th}>Sessões Agendadas</th>
                      <th style={s.th}>Sessões Iniciadas</th>
                      <th style={s.th}>Não Iniciadas</th>
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
  );
}

// ============================================================
// ESTILOS
// ============================================================
const s = {
  container: { maxWidth: 900, margin: "30px auto", padding: "0 20px", fontFamily: "sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  titulo: { margin: 0, color: "#007bff" },
  btnVoltar: { padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: 4, cursor: "pointer" },
  filtros: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 20 },
  inputMes: { padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 },
  btnBuscar: { padding: "8px 20px", background: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14 },
  btnImprimir: { padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14 },
  relatorioHeader: { background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 8, padding: 16, marginBottom: 16 },
  vazio: { padding: 20, background: "#f8f9fa", borderRadius: 8, color: "#888", textAlign: "center" },
  cardEstagiario: { border: "1px solid #dee2e6", borderRadius: 8, marginBottom: 16, overflow: "hidden" },
  estHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#e9f0ff", padding: "12px 16px" },
  estNome: { margin: 0, fontWeight: "bold", fontSize: 15 },
  estInfo: { margin: "4px 0 0", fontSize: 13, color: "#555" },
  badge: { background: "#007bff", color: "white", padding: "4px 10px", borderRadius: 12, fontSize: 12 },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { background: "#f8f9fa", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #dee2e6", fontWeight: "600" },
  td: { padding: "10px 12px", verticalAlign: "middle" },
};
