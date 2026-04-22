// Importa o useState para controlar estados (dados) dentro da tela
import { useState } from "react"

// Importa o useNavigate para fazer navegação entre telas
import { useNavigate } from "react-router-dom"

// Componente da tela de Agendamentos
// Recebe via props:
// - pacientes (lista de pacientes)
// - agendamentos (lista de agendamentos já feitos)
// - adicionarAgendamento (função para salvar novo agendamento)
function Agendamentos({ pacientes, agendamentos, adicionarAgendamento }) {

  // Estado que guarda o paciente selecionado no select
  const [paciente, setPaciente] = useState("")

  // Estado que guarda a data escolhida
  const [data, setData] = useState("")

  // Estado que guarda o horário escolhido
  const [hora, setHora] = useState("")

  // Estado para mensagens de erro
  const [erro, setErro] = useState("")

  // Estado para mensagem de sucesso
  const [sucesso, setSucesso] = useState("")

  // Estado que guarda a sala selecionada
  const [sala, setSala] = useState("")

  // Hook para navegação entre páginas
  const navigate = useNavigate()

  // Função para voltar ao dashboard
  function voltar_dashboard() {
    navigate("/dashboard")
  }

  // Função principal de agendamento
  function agendar() {

    // Validação: verifica se todos os campos foram preenchidos
    if (!paciente || !data || !hora || !sala) {
      setErro("Preencha todos os campos.") // mostra erro
      setSucesso("") // limpa sucesso
      return // interrompe execução
    }

    // Busca o paciente selecionado dentro da lista de pacientes
    const pacienteSelecionado = pacientes.find(
      (p) => String(p.id) === paciente
    )

    // Se não encontrar o paciente, mostra erro
    if (!pacienteSelecionado) {
      setErro("Paciente não encontrado.")
      setSucesso("")
      return
    }

    // Cria o objeto de agendamento
    const novoAgendamento = {
      id: Date.now(), // cria um ID único baseado no tempo
      nomePaciente: pacienteSelecionado.nome, // nome do paciente
      data: data, // data selecionada
      hora: hora, // horário selecionado
      sala: sala // sala escolhida
    }

    // Logs para debug (ver no console do navegador)
    console.log("clicou em agendar")
    console.log("paciente selecionado id:", paciente)
    console.log("data:", data)
    console.log("hora:", hora)
    console.log("sala:", sala)

    // Chama a função que veio do App.jsx para salvar o agendamento
    adicionarAgendamento(novoAgendamento)
    
    // Mensagem de sucesso
    setSucesso("Paciente agendado com sucesso!")

    // Limpa mensagem de erro
    setErro("")

    // Limpa os campos após salvar
    setData("")
    setHora("")
    setPaciente("")
    setSala("")
  }

  // Mostra no console todos os agendamentos (debug)
  console.log(agendamentos)

  // Retorno da interface da tela
  return (
    <div>
      
      {/* Título da página */}
      <h1>Meus Agendamentos</h1>

      {/* Select para escolher o paciente */}
      <select value={paciente} onChange={(e) => setPaciente(e.target.value)}>
        <option value="">Selecione um paciente</option>

        {/* Percorre a lista de pacientes e cria opções */}
        {pacientes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>

      {/* Select para escolher a sala */}
      <select value={sala} onChange={(e) => setSala(e.target.value)}>
        <option value="">Selecione uma sala</option>
        <option value="Sala 1">Sala 1</option>
        <option value="Sala 2">Sala 2</option>
        <option value="Sala 3">Sala 3</option>
        <option value="Sala 4">Sala 4</option>
        <option value="Sala 5">Sala 5</option>
        <option value="Sala 6">Sala 6</option>
        <option value="Sala 7">Sala 7</option>
      </select>

      {/* Campo para selecionar data */}
      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />

      {/* Campo para selecionar horário */}
      <input
        type="time"
        value={hora}
        onChange={(e) => setHora(e.target.value)}
      />

      {/* Botão que chama a função de agendar */}
      <button onClick={agendar}>Agendar</button>

      {/* Botão para voltar ao dashboard */}
      <button onClick={voltar_dashboard}>Voltar</button>

      {/* Mostra erro apenas se existir */}
      {erro && <p style={{ color: "red" }}>{erro}</p>}

      {/* Mostra sucesso apenas se existir */}
      {sucesso && <p style={{ color: "green" }}>{sucesso}</p>}

      {/* Lista de agendamentos */}
      {agendamentos.map((a) => (
        <div
          key={a.id}
          style={{
            border: "1px solid black",
            margin: "10px",
            padding: "10px"
          }}
        >
          <p>Paciente: {a.nomePaciente}</p>
          <p>Data: {a.data}</p>
          <p>Hora: {a.hora}</p>
          <p>Sala: {a.sala}</p>
        </div>
      ))}
    
    </div>
  )
}

// Exporta o componente para ser usado no App.jsx
export default Agendamentos