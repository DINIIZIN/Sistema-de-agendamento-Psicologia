import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";

function Pacientes({ atualizarLista, usuario, pacientes, limites }) {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [editando, setEditando] = useState(null); // paciente sendo editado
  const navigate = useNavigate();

  const limiteAtingido = limites && limites.totalPacientes >= limites.maxPacientes;

  async function cadastrar() {
    if (!nome || !cpf) { setErro("Nome e CPF são obrigatórios."); return; }
    setErro(""); setSucesso("");
    try {
      await api.post('/pacientes', { nome, cpf, endereco, email, telefone });
      await atualizarLista();
      setSucesso("Paciente cadastrado com sucesso!");
      setNome(""); setCpf(""); setEndereco(""); setEmail(""); setTelefone("");
    } catch (err) {
      setErro(err.error || "Erro ao cadastrar paciente.");
    }
  }

  async function salvarEdicao() {
    if (!editando.nome_enc || !editando.cpf_hash) { setErro("Nome e CPF são obrigatórios."); return; }
    setErro(""); setSucesso("");
    try {
      await api.put(`/pacientes/${editando.id}`, {
        nome: editando.nome_enc,
        cpf: editando.cpf_hash,
        endereco: editando.endereco,
        email: editando.email,
        telefone: editando.telefone,
      });
      await atualizarLista();
      setSucesso("Paciente atualizado!");
      setEditando(null);
    } catch (err) {
      setErro(err.error || "Erro ao atualizar paciente.");
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "20px auto", padding: 20 }}>
      <h1>Pacientes</h1>

      {limites && (
        <div style={{ background: limiteAtingido ? "#fff0f0" : "#f0fff0", border: `1px solid ${limiteAtingido ? "#ffcccc" : "#ccffcc"}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <strong>Pacientes cadastrados: {limites.totalPacientes} / {limites.maxPacientes}</strong>
          {limiteAtingido && <span style={{ color: "red", marginLeft: 8 }}>— Limite atingido</span>}
        </div>
      )}

      {!limiteAtingido && (
        <>
          <h2>Novo Paciente</h2>
          <input type="text" placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }} />
          <input type="text" placeholder="CPF *" value={cpf} onChange={(e) => setCpf(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }} />
          <input type="text" placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }} />
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }} />
          <input type="text" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 8 }} />
          <button onClick={cadastrar} style={{ width: "100%", padding: 10, marginBottom: 8 }}>Cadastrar Paciente</button>
        </>
      )}

      <button onClick={() => navigate("/Dashboard")} style={{ width: "100%", padding: 10, marginBottom: 16 }}>Voltar</button>

      {erro && <p style={{ color: "red" }}>{erro}</p>}
      {sucesso && <p style={{ color: "green" }}>{sucesso}</p>}

      <h2>Pacientes Cadastrados ({pacientes.length})</h2>
      {pacientes.length === 0 ? (
        <p>Nenhum paciente cadastrado ainda.</p>
      ) : (
        pacientes.map((p) => (
          <div key={p.id} style={{ border: "1px solid #ccc", margin: "8px 0", padding: 12, borderRadius: 6 }}>
            {editando?.id === p.id ? (
              <>
                <input value={editando.nome_enc} onChange={(e) => setEditando({ ...editando, nome_enc: e.target.value })} placeholder="Nome" style={{ width: "100%", padding: 8, marginBottom: 6 }} />
                <input value={editando.cpf_hash || ""} onChange={(e) => setEditando({ ...editando, cpf_hash: e.target.value })} placeholder="CPF" style={{ width: "100%", padding: 8, marginBottom: 6 }} />
                <input value={editando.endereco || ""} onChange={(e) => setEditando({ ...editando, endereco: e.target.value })} placeholder="Endereço" style={{ width: "100%", padding: 8, marginBottom: 6 }} />
                <input value={editando.email || ""} onChange={(e) => setEditando({ ...editando, email: e.target.value })} placeholder="E-mail" style={{ width: "100%", padding: 8, marginBottom: 6 }} />
                <input value={editando.telefone || ""} onChange={(e) => setEditando({ ...editando, telefone: e.target.value })} placeholder="Telefone" style={{ width: "100%", padding: 8, marginBottom: 6 }} />
                <button onClick={salvarEdicao} style={{ marginRight: 8 }}>Salvar</button>
                <button onClick={() => setEditando(null)}>Cancelar</button>
              </>
            ) : (
              <>
                <p><strong>Nome:</strong> {p.nome}</p>
                <p><strong>CPF:</strong> {p.cpf}</p>
                {p.telefone && <p><strong>Telefone:</strong> {p.telefone}</p>}
                {p.email && <p><strong>E-mail:</strong> {p.email}</p>}
                {p.endereco && <p><strong>Endereço:</strong> {p.endereco}</p>}
                <button onClick={() => setEditando({ id: p.id, nome_enc: p.nome, cpf_hash: p.cpf, endereco: p.endereco, email: p.email, telefone: p.telefone })}>
                  ✏️ Editar
                </button>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default Pacientes;
