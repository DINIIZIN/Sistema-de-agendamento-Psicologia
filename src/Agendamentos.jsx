import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";

const TODAS_SALAS = [1, 2, 3, 4, 5, 6, 7];

function Agendamentos({ pacientes, agendamentos, atualizarLista, usuario, limites }) {
  const [paciente, setPaciente] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [sala, setSala] = useState("");
  const [salasOcupadas, setSalasOcupadas] = useState([]);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editSala, setEditSala] = useState("");
  const [editSalasOcupadas, setEditSalasOcupadas] = useState([]);
  const navigate = useNavigate();

  // Busca salas ocupadas sempre que data ou hora mudar
  useEffect(() => {
    if (!data || !hora) { setSalasOcupadas([]); return; }
    const data_inicio = `${data} ${hora}`;
    api.get(`/salas-disponiveis?data_inicio=${encodeURIComponent(data_inicio)}`)
      .then(res => setSalasOcupadas(res.salasOcupadas))
      .catch(() => setSalasOcupadas([]));
  }, [data, hora]);

  // Busca salas ocupadas para edição
  useEffect(() => {
    if (!editData || !editHora) { setEditSalasOcupadas([]); return; }
    const data_inicio = `${editData} ${editHora}`;
    api.get(`/salas-disponiveis?data_inicio=${encodeURIComponent(data_inicio)}`)
      .then(res => setEditSalasOcupadas(res.salasOcupadas))
      .catch(() => setEditSalasOcupadas([]));
  }, [editData, editHora]);

  // Conta sessões do paciente selecionado
  function sessoesRestantes(pacienteId) {
    if (!limites) return null;
    const s = limites.sessoesPorPaciente.find(x => x.paciente_id === parseInt(pacienteId));
    return limites.maxSessoes - (s ? s.sessoes : 0);
  }

  async function agendar() {
    if (!paciente || !data || !hora || !sala) { setErro("Preencha todos os campos."); return; }
    setErro(""); setSucesso("");
    try {
      await api.post('/agendamentos', { paciente_id: paciente, sala_id: sala, data_inicio: `${data} ${hora}` });
      await atualizarLista();
      setSucesso("Agendamento realizado com sucesso!");
      setPaciente(""); setData(""); setHora(""); setSala(""); setSalasOcupadas([]);
    } catch (err) {
      setErro(err.error || "Erro ao agendar.");
    }
  }

  async function cancelar(id) {
    if (!window.confirm("Deseja cancelar este agendamento?")) return;
    try {
      await api.delete(`/agendamentos/${id}`);
      await atualizarLista();
      setSucesso("Agendamento cancelado.");
    } catch (err) {
      setErro(err.error || "Erro ao cancelar.");
    }
  }

  function iniciarEdicao(a) {
    setEditandoId(a.id);
    const [d, h] = a.data_inicio.split(' ');
    setEditData(d);
    setEditHora(h);
    setEditSala(a.sala_id);
  }

  async function salvarEdicao(id) {
    if (!editData || !editHora || !editSala) { setErro("Preencha todos os campos."); return; }
    setErro(""); setSucesso("");
    try {
      await api.put(`/agendamentos/${id}`, { sala_id: editSala, data_inicio: `${editData} ${editHora}` });
      await atualizarLista();
      setSucesso("Agendamento atualizado!");
      setEditandoId(null);
    } catch (err) {
      setErro(err.error || "Erro ao atualizar.");
    }
  }

  const sessoesRestantesPacienteSelecionado = paciente ? sessoesRestantes(paciente) : null;

  return (
    <div style={{ maxWidth: 700, margin: "20px auto", padding: 20 }}>
      <h1>Agendamentos</h1>

      <h2>Novo Agendamento</h2>

      {/* Seleção de paciente */}
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

      {sessoesRestantesPacienteSelecionado !== null && (
        <p style={{ color: sessoesRestantesPacienteSelecionado <= 0 ? "red" : sessoesRestantesPacienteSelecionado <= 2 ? "orange" : "green", marginBottom: 8 }}>
          {sessoesRestantesPacienteSelecionado <= 0
            ? "⚠️ Este paciente não tem mais sessões disponíveis."
            : `✅ ${sessoesRestantesPacienteSelecionado} sessões restantes com este paciente.`}
        </p>
      )}

      {/* Data e hora */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ flex: 1, padding: 10 }} />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ flex: 1, padding: 10 }} />
      </div>

      {/* Seleção de sala com bloqueio em tempo real */}
      <select value={sala} onChange={(e) => setSala(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }}
        disabled={!data || !hora}>
        <option value="">{!data || !hora ? "Escolha data e hora primeiro" : "Selecione uma sala"}</option>
        {TODAS_SALAS.map((s) => {
          const ocupada = salasOcupadas.includes(s);
          return (
            <option key={s} value={s} disabled={ocupada}>
              Sala {s} {ocupada ? "— Ocupada" : "— Disponível"}
            </option>
          );
        })}
      </select>

      {data && hora && salasOcupadas.length > 0 && (
        <p style={{ color: "orange", fontSize: "0.9em", marginBottom: 8 }}>
          ⚠️ {salasOcupadas.length} sala(s) ocupada(s) neste horário.
        </p>
      )}

      <button onClick={agendar} style={{ width: "100%", padding: 10, marginBottom: 8 }}>Agendar</button>
      <button onClick={() => navigate("/Dashboard")} style={{ width: "100%", padding: 10, marginBottom: 16 }}>Voltar</button>

      {erro && <p style={{ color: "red" }}>{erro}</p>}
      {sucesso && <p style={{ color: "green" }}>{sucesso}</p>}

      {/* Lista de agendamentos */}
      <h2>Agendamentos Realizados ({agendamentos.length})</h2>
      {agendamentos.length === 0 ? (
        <p>Nenhum agendamento encontrado.</p>
      ) : (
        agendamentos.map((a) => (
          <div key={a.id} style={{ border: "1px solid #ccc", margin: "8px 0", padding: 12, borderRadius: 6 }}>
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
              <>
                <p><strong>Paciente:</strong> {a.nomePaciente}</p>
                <p><strong>Estagiário:</strong> {a.nomeEstagiario}</p>
                <p><strong>Data:</strong> {a.data_inicio}</p>
                <p><strong>Sala:</strong> {a.sala_id}</p>
                <button onClick={() => iniciarEdicao(a)} style={{ marginRight: 8 }}>✏️ Editar</button>
                <button onClick={() => cancelar(a.id)} style={{ color: "red" }}>❌ Cancelar</button>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default Agendamentos;
