// ============================================================
// Agendamentos.jsx — agendamento de sessões pelo estagiário
// ============================================================
// Funcionalidades:
//   - Criar novo agendamento (paciente, data, hora, sala)
//   - Verificar salas disponíveis em tempo real
//   - Editar agendamentos existentes
//   - Iniciar sessão com verificação de geolocalização
//   - Exibir status da sessão (aguardando / iniciada)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";

// IDs das salas disponíveis na clínica
const TODAS_SALAS = [1, 2, 3, 4, 5, 6, 7];

function Agendamentos({ pacientes, agendamentos, atualizarLista, usuario, limites }) {
  // Campos do formulário de novo agendamento
  const [paciente, setPaciente] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [sala, setSala] = useState("");

  // Lista de salas já ocupadas no horário selecionado (para novo agendamento)
  const [salasOcupadas, setSalasOcupadas] = useState([]);

  // Mensagens de feedback
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Controle de edição de agendamento existente
  const [editandoId, setEditandoId] = useState(null);
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editSala, setEditSala] = useState("");
  const [editSalasOcupadas, setEditSalasOcupadas] = useState([]);

  // ID do agendamento aguardando resposta de geolocalização
  const [iniciando, setIniciando] = useState(null);

  const navigate = useNavigate();

  // ============================================================
  // Busca salas ocupadas sempre que data ou hora do novo agendamento mudar
  // ============================================================
  useEffect(() => {
    if (!data || !hora) { setSalasOcupadas([]); return; }
    const data_inicio = `${data} ${hora}`;
    api.get(`/salas-disponiveis?data_inicio=${encodeURIComponent(data_inicio)}`)
      .then(res => setSalasOcupadas(res.salasOcupadas))
      .catch(() => setSalasOcupadas([]));
  }, [data, hora]);

  // Busca salas ocupadas para o formulário de edição
  useEffect(() => {
    if (!editData || !editHora) { setEditSalasOcupadas([]); return; }
    const data_inicio = `${editData} ${editHora}`;
    api.get(`/salas-disponiveis?data_inicio=${encodeURIComponent(data_inicio)}`)
      .then(res => setEditSalasOcupadas(res.salasOcupadas))
      .catch(() => setEditSalasOcupadas([]));
  }, [editData, editHora]);

  // Retorna quantas sessões restam para um paciente específico
  function sessoesRestantes(pacienteId) {
    if (!limites) return null;
    const s = limites.sessoesPorPaciente.find(x => x.paciente_id === parseInt(pacienteId));
    return limites.maxSessoes - (s ? s.sessoes : 0);
  }

  // ============================================================
  // Cria um novo agendamento
  // ============================================================
  async function agendar() {
    if (!paciente || !data || !hora || !sala) { setErro("Preencha todos os campos."); return; }
    setErro(""); setSucesso("");
    try {
      await api.post('/agendamentos', { paciente_id: paciente, sala_id: sala, data_inicio: `${data} ${hora}` });
      await atualizarLista();
      setSucesso("Agendamento realizado com sucesso!");
      // Limpa o formulário após o agendamento
      setPaciente(""); setData(""); setHora(""); setSala(""); setSalasOcupadas([]);
    } catch (err) {
      setErro(err.error || "Erro ao agendar.");
    }
  }

  // Ativa o modo de edição preenchendo os campos com os dados atuais
  function iniciarEdicao(a) {
    setEditandoId(a.id);
    const [d, h] = a.data_inicio.split(' ');
    setEditData(d);
    setEditHora(h);
    setEditSala(a.sala_id);
  }

  // ============================================================
  // Salva as alterações de um agendamento editado
  // ============================================================
  async function salvarEdicao(id) {
    if (!editData || !editHora || !editSala) { setErro("Preencha todos os campos."); return; }
    setErro(""); setSucesso("");
    try {
      await api.put(`/agendamentos/${id}`, { sala_id: editSala, data_inicio: `${editData} ${editHora}` });
      await atualizarLista();
      setSucesso("Agendamento atualizado!");
      setEditandoId(null); // Sai do modo de edição
    } catch (err) {
      setErro(err.error || "Erro ao atualizar.");
    }
  }

  // ============================================================
  // Inicia uma sessão com verificação de geolocalização
  // O navegador solicita a localização do estagiário,
  // que é enviada ao servidor para verificar se está na clínica
  // ============================================================
  async function iniciarSessao(id) {
    setIniciando(id); // Marca o agendamento como "aguardando GPS"
    setErro(""); setSucesso("");

    // Verifica se o navegador suporta geolocalização
    if (!navigator.geolocation) {
      setErro("Seu navegador não suporta geolocalização.");
      setIniciando(null);
      return;
    }

    // Solicita a posição atual do dispositivo
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Sucesso: envia as coordenadas para o servidor
        try {
          const res = await fetch(`http://localhost:3001/api/agendamentos/${id}/iniciar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              latitude: pos.coords.latitude,   // Latitude atual do estagiário
              longitude: pos.coords.longitude, // Longitude atual do estagiário
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setSucesso("Sessão iniciada com sucesso!");
            await atualizarLista(); // Atualiza o status na lista
          } else {
            // Servidor retornou erro (ex: fora do raio permitido)
            setErro(data.error || "Erro ao iniciar sessão.");
          }
        } catch {
          setErro("Erro ao conectar com o servidor.");
        }
        setIniciando(null);
      },
      (err) => {
        // Erro ao obter localização (usuário negou, GPS desligado, etc.)
        if (err.code === 1) {
          setErro("Permissão de localização negada. Permita o acesso para iniciar a sessão.");
        } else {
          setErro("Não foi possível obter sua localização. Tente novamente.");
        }
        setIniciando(null);
      },
      { enableHighAccuracy: true, timeout: 10000 } // Usa GPS de alta precisão, timeout de 10s
    );
  }

  // Sessões restantes do paciente selecionado no formulário
  const sessoesRestantesPacienteSelecionado = paciente ? sessoesRestantes(paciente) : null;

  return (
    <div style={{ maxWidth: 700, margin: "20px auto", padding: 20 }}>
      <h1>Agendamentos</h1>
      <h2>Novo Agendamento</h2>

      {/* Seleção de paciente com indicador de sessões restantes */}
      <select value={paciente} onChange={(e) => setPaciente(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }}>
        <option value="">Selecione um paciente</option>
        {pacientes.map((p) => {
          const restantes = sessoesRestantes(p.id);
          const esgotado = restantes !== null && restantes <= 0;
          return (
            <option key={p.id} value={p.id} disabled={esgotado}>
              {p.nome} {esgotado ? "— Sessões esgotadas" : restantes !== null ? `(${restantes} sessões restantes)` : ""}
            </option>
          );
        })}
      </select>

      {/* Indicador de sessões restantes colorido (verde/laranja/vermelho) */}
      {sessoesRestantesPacienteSelecionado !== null && (
        <p style={{ color: sessoesRestantesPacienteSelecionado <= 0 ? "red" : sessoesRestantesPacienteSelecionado <= 2 ? "orange" : "green", marginBottom: 8 }}>
          {sessoesRestantesPacienteSelecionado <= 0
            ? "⚠️ Este paciente não tem mais sessões disponíveis."
            : `✅ ${sessoesRestantesPacienteSelecionado} sessões restantes com este paciente.`}
        </p>
      )}

      {/* Seleção de data e hora lado a lado */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ flex: 1, padding: 10 }} />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ flex: 1, padding: 10 }} />
      </div>

      {/* Seleção de sala — desabilitada até que data e hora sejam preenchidos */}
      <select value={sala} onChange={(e) => setSala(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }} disabled={!data || !hora}>
        <option value="">{!data || !hora ? "Escolha data e hora primeiro" : "Selecione uma sala"}</option>
        {TODAS_SALAS.map((s) => {
          const ocupada = salasOcupadas.includes(s); // Verifica se a sala está ocupada no horário
          return (
            <option key={s} value={s} disabled={ocupada}>
              Sala {s} {ocupada ? "— Ocupada" : "— Disponível"}
            </option>
          );
        })}
      </select>

      {/* Aviso de salas ocupadas */}
      {data && hora && salasOcupadas.length > 0 && (
        <p style={{ color: "orange", fontSize: "0.9em", marginBottom: 8 }}>
          ⚠️ {salasOcupadas.length} sala(s) ocupada(s) neste horário.
        </p>
      )}

      <button onClick={agendar} style={{ width: "100%", padding: 10, marginBottom: 8 }}>Agendar</button>
      <button onClick={() => navigate("/Dashboard")} style={{ width: "100%", padding: 10, marginBottom: 16 }}>Voltar</button>

      {erro && <p style={{ color: "red" }}>{erro}</p>}
      {sucesso && <p style={{ color: "green" }}>{sucesso}</p>}

      {/* Lista de agendamentos existentes */}
      <h2>Agendamentos Realizados ({agendamentos.length})</h2>
      {agendamentos.length === 0 ? (
        <p>Nenhum agendamento encontrado.</p>
      ) : (
        agendamentos.map((a) => (
          <div key={a.id} style={{ border: "1px solid #ccc", margin: "8px 0", padding: 12, borderRadius: 6 }}>

            {/* Formulário de edição inline */}
            {editandoId === a.id ? (
              <>
                <p><strong>Paciente:</strong> {a.nomePaciente}</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} style={{ flex: 1, padding: 8 }} />
                  <input type="time" value={editHora} onChange={(e) => setEditHora(e.target.value)} style={{ flex: 1, padding: 8 }} />
                </div>
                <select value={editSala} onChange={(e) => setEditSala(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 6 }}>
                  <option value="">Selecione uma sala</option>
                  {TODAS_SALAS.map((s) => {
                    // Permite manter a sala atual mesmo que apareça como ocupada
                    const ocupada = editSalasOcupadas.includes(s) && parseInt(editSala) !== s;
                    return (
                      <option key={s} value={s} disabled={ocupada}>
                        Sala {s} {ocupada ? "— Ocupada" : "— Disponível"}
                      </option>
                    );
                  })}
                </select>
                <button onClick={() => salvarEdicao(a.id)} style={{ marginRight: 8 }}>Salvar</button>
                <button onClick={() => setEditandoId(null)}>Cancelar</button>
              </>
            ) : (
              // Exibição normal do agendamento
              <>
                <p><strong>Paciente:</strong> {a.nomePaciente}</p>
                <p><strong>Estagiário:</strong> {a.nomeEstagiario}</p>
                <p><strong>Data:</strong> {a.data_inicio}</p>
                <p><strong>Sala:</strong> {a.sala_id}</p>

                {/* Status da sessão: aguardando ou iniciada com horário real */}
                <p>
                  <strong>Status:</strong>{" "}
                  {a.sessao_iniciada
                    ? <span style={{ color: "green" }}>✅ Sessão iniciada {a.data_inicio_real ? `às ${a.data_inicio_real}` : ""}</span>
                    : <span style={{ color: "#888" }}>⏳ Aguardando início</span>
                  }
                </p>

                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {/* Botão de iniciar sessão — só aparece se ainda não foi iniciada */}
                  {!a.sessao_iniciada && a.status === "AGENDADO" && (
                    <button
                      onClick={() => iniciarSessao(a.id)}
                      disabled={iniciando === a.id} // Desabilitado enquanto aguarda o GPS
                      style={{ padding: "6px 12px", background: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                      {iniciando === a.id ? "Verificando localização..." : "▶️ Iniciar Sessão"}
                    </button>
                  )}

                  {/* Botão de edição — só disponível antes de iniciar a sessão */}
                  {!a.sessao_iniciada && (
                    <button onClick={() => iniciarEdicao(a)} style={{ padding: "6px 12px" }}>✏️ Editar</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default Agendamentos;
