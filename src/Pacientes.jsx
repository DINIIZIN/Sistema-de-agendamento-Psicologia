// ============================================================
// Pacientes.jsx — cadastro e listagem de pacientes do estagiário
// ============================================================
// Funcionalidades:
//   - Cadastrar paciente com dados pessoais
//   - Detectar automaticamente menores de idade pela data de nascimento
//   - Exigir dados do responsável legal para menores de 18 anos
//   - Editar pacientes existentes
//   - Exibir limite de pacientes por estagiário
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";

// Calcula a idade em anos a partir de uma data de nascimento
// Retorna null se a data não for fornecida
function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  return Math.floor((new Date() - new Date(dataNascimento)) / (365.25 * 24 * 60 * 60 * 1000));
}

function Pacientes({ atualizarLista, usuario, pacientes, limites }) {
  // Estados dos campos do formulário de cadastro
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");

  // Mensagens de feedback
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Paciente sendo editado (null = nenhum)
  const [editando, setEditando] = useState(null);

  const navigate = useNavigate();

  // Verifica se o limite de pacientes foi atingido
  const limiteAtingido = limites && limites.totalPacientes >= limites.maxPacientes;

  // Calcula a idade para o formulário de cadastro em tempo real
  const idadeForm = calcularIdade(dataNascimento);
  const eMenorForm = idadeForm !== null && idadeForm < 18; // true se for menor de 18

  // ============================================================
  // Cadastra um novo paciente
  // ============================================================
  async function cadastrar() {
    if (!nome || !cpf) { setErro("Nome e CPF são obrigatórios."); return; }

    // Valida dados do responsável se for menor de idade
    if (eMenorForm && !responsavelNome) { setErro("Paciente menor de idade requer nome do responsável."); return; }

    setErro(""); setSucesso("");
    try {
      await api.post('/pacientes', {
        nome, cpf, endereco, email, telefone,
        data_nascimento: dataNascimento || null,
        responsavel_nome: responsavelNome || null,
        responsavel_telefone: responsavelTelefone || null,
      });
      await atualizarLista(); // Atualiza a lista após cadastro
      setSucesso("Paciente cadastrado com sucesso!");

      // Limpa todos os campos após o cadastro
      setNome(""); setCpf(""); setEndereco(""); setEmail(""); setTelefone("");
      setDataNascimento(""); setResponsavelNome(""); setResponsavelTelefone("");
    } catch (err) {
      setErro(err.error || "Erro ao cadastrar paciente.");
    }
  }

  // ============================================================
  // Salva a edição de um paciente existente
  // ============================================================
  async function salvarEdicao() {
    if (!editando.nome_enc || !editando.cpf_hash) { setErro("Nome e CPF são obrigatórios."); return; }

    // Valida dados do responsável no formulário de edição
    const idadeEdit = calcularIdade(editando.data_nascimento);
    if (idadeEdit !== null && idadeEdit < 18 && !editando.responsavel_nome) {
      setErro("Paciente menor de idade requer nome do responsável."); return;
    }

    setErro(""); setSucesso("");
    try {
      await api.put(`/pacientes/${editando.id}`, {
        nome: editando.nome_enc,
        cpf: editando.cpf_hash,
        endereco: editando.endereco,
        email: editando.email,
        telefone: editando.telefone,
        data_nascimento: editando.data_nascimento || null,
        responsavel_nome: editando.responsavel_nome || null,
        responsavel_telefone: editando.responsavel_telefone || null,
      });
      await atualizarLista();
      setSucesso("Paciente atualizado!");
      setEditando(null); // Sai do modo de edição
    } catch (err) {
      setErro(err.error || "Erro ao atualizar paciente.");
    }
  }

  // Estilo reutilizável para os inputs
  const inp = { width: "100%", padding: 10, marginBottom: 8, boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 600, margin: "20px auto", padding: 20 }}>
      <h1>Pacientes</h1>

      {/* Barra de limite de pacientes */}
      {limites && (
        <div style={{ background: limiteAtingido ? "#fff0f0" : "#f0fff0", border: `1px solid ${limiteAtingido ? "#ffcccc" : "#ccffcc"}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <strong>Pacientes cadastrados: {limites.totalPacientes} / {limites.maxPacientes}</strong>
          {limiteAtingido && <span style={{ color: "red", marginLeft: 8 }}>— Limite atingido</span>}
        </div>
      )}

      {/* Formulário de cadastro — oculto se o limite foi atingido */}
      {!limiteAtingido && (
        <>
          <h2>Novo Paciente</h2>
          <input type="text" placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} style={inp} />
          <input type="text" placeholder="CPF *" value={cpf} onChange={(e) => setCpf(e.target.value)} style={inp} />
          <input type="text" placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} style={inp} />
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
          <input type="text" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={inp} />

          <label style={{ fontSize: 13, color: "#555" }}>Data de Nascimento</label>
          <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} style={inp} />

          {/* Seção de responsável — aparece automaticamente quando detecta menor de idade */}
          {eMenorForm && (
            <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <strong>⚠️ Menor de idade ({idadeForm} anos) — dados do responsável obrigatórios</strong>
              <input type="text" placeholder="Nome do responsável *" value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} style={{ ...inp, marginTop: 8 }} />
              <input type="text" placeholder="Telefone do responsável" value={responsavelTelefone} onChange={(e) => setResponsavelTelefone(e.target.value)} style={inp} />
            </div>
          )}

          <button onClick={cadastrar} style={{ width: "100%", padding: 10, marginBottom: 8 }}>Cadastrar Paciente</button>
        </>
      )}

      <button onClick={() => navigate("/Dashboard")} style={{ width: "100%", padding: 10, marginBottom: 16 }}>Voltar</button>

      {erro && <p style={{ color: "red" }}>{erro}</p>}
      {sucesso && <p style={{ color: "green" }}>{sucesso}</p>}

      {/* Lista de pacientes cadastrados */}
      <h2>Pacientes Cadastrados ({pacientes.length})</h2>
      {pacientes.length === 0 ? (
        <p>Nenhum paciente cadastrado ainda.</p>
      ) : (
        pacientes.map((p) => {
          const idade = calcularIdade(p.data_nascimento);
          const eMenor = idade !== null && idade < 18;
          return (
            <div key={p.id} style={{ border: "1px solid #ccc", margin: "8px 0", padding: 12, borderRadius: 6 }}>

              {/* Formulário de edição inline */}
              {editando?.id === p.id ? (
                <>
                  <input value={editando.nome_enc} onChange={(e) => setEditando({ ...editando, nome_enc: e.target.value })} placeholder="Nome" style={inp} />
                  <input value={editando.cpf_hash || ""} onChange={(e) => setEditando({ ...editando, cpf_hash: e.target.value })} placeholder="CPF" style={inp} />
                  <input value={editando.endereco || ""} onChange={(e) => setEditando({ ...editando, endereco: e.target.value })} placeholder="Endereço" style={inp} />
                  <input value={editando.email || ""} onChange={(e) => setEditando({ ...editando, email: e.target.value })} placeholder="E-mail" style={inp} />
                  <input value={editando.telefone || ""} onChange={(e) => setEditando({ ...editando, telefone: e.target.value })} placeholder="Telefone" style={inp} />
                  <label style={{ fontSize: 13, color: "#555" }}>Data de Nascimento</label>
                  <input type="date" value={editando.data_nascimento || ""} onChange={(e) => setEditando({ ...editando, data_nascimento: e.target.value })} style={inp} />

                  {/* Seção de responsável no modo de edição */}
                  {calcularIdade(editando.data_nascimento) < 18 && editando.data_nascimento && (
                    <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <strong>⚠️ Menor de idade — dados do responsável obrigatórios</strong>
                      <input value={editando.responsavel_nome || ""} onChange={(e) => setEditando({ ...editando, responsavel_nome: e.target.value })} placeholder="Nome do responsável *" style={{ ...inp, marginTop: 8 }} />
                      <input value={editando.responsavel_telefone || ""} onChange={(e) => setEditando({ ...editando, responsavel_telefone: e.target.value })} placeholder="Telefone do responsável" style={inp} />
                    </div>
                  )}
                  <button onClick={salvarEdicao} style={{ marginRight: 8 }}>Salvar</button>
                  <button onClick={() => setEditando(null)}>Cancelar</button>
                </>
              ) : (
                // Exibição normal do paciente
                <>
                  <p>
                    <strong>Nome:</strong> {p.nome}{" "}
                    {/* Badge amarelo para indicar menor de idade */}
                    {eMenor && <span style={{ background: "#ffe082", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>Menor ({idade} anos)</span>}
                  </p>
                  <p><strong>CPF:</strong> {p.cpf}</p>
                  {p.data_nascimento && <p><strong>Nascimento:</strong> {new Date(p.data_nascimento).toLocaleDateString('pt-BR')}</p>}
                  {p.telefone && <p><strong>Telefone:</strong> {p.telefone}</p>}
                  {p.email && <p><strong>E-mail:</strong> {p.email}</p>}
                  {p.endereco && <p><strong>Endereço:</strong> {p.endereco}</p>}

                  {/* Dados do responsável (exibido apenas para menores) */}
                  {eMenor && p.responsavel_nome && (
                    <div style={{ background: "#fff8e1", borderRadius: 4, padding: "6px 10px", marginTop: 6 }}>
                      <p style={{ margin: 0 }}><strong>Responsável:</strong> {p.responsavel_nome}</p>
                      {p.responsavel_telefone && <p style={{ margin: 0 }}><strong>Tel. Responsável:</strong> {p.responsavel_telefone}</p>}
                    </div>
                  )}

                  {/* Botão de edição — preenche o estado editando com os dados atuais */}
                  <button style={{ marginTop: 8 }} onClick={() => setEditando({
                    id: p.id, nome_enc: p.nome, cpf_hash: p.cpf,
                    endereco: p.endereco, email: p.email, telefone: p.telefone,
                    data_nascimento: p.data_nascimento,
                    responsavel_nome: p.responsavel_nome,
                    responsavel_telefone: p.responsavel_telefone
                  })}>
                    ✏️ Editar
                  </button>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default Pacientes;
