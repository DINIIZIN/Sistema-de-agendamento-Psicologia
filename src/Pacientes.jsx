// Importa o useState para controlar os dados dos inputs
import { useState } from "react"

// Importa o useNavigate para navegação entre telas
import { useNavigate } from "react-router-dom"

// Componente da tela de Pacientes
// Recebe via props a função adicionarPaciente (vem do App.jsx)
function Pacientes({adicionarPaciente}){

  // Estados para armazenar os dados digitados no formulário
  const[nome, setNome] = useState("")          // nome do paciente
  const[endereco, setEndereco] = useState("")  // endereço
  const[email, setEmail] = useState("")        // e-mail
  const[telefone, setTelefone] = useState("")  // telefone
  const[cpf, setCpf] = useState("")            // CPF

  // Estados para mensagens
  const[erro, setErro] = useState("")          // mensagem de erro
  const[sucesso, setSucesso] = useState("")    // mensagem de sucesso

  // Hook para navegação
  const navigate = useNavigate()

  // Função para voltar para o dashboard
  function voltar_dashboard(){
    navigate("/dashboard")
  }

  // Função principal para cadastrar paciente
  function confirmar_dados(){

    // Validação: verifica se todos os campos foram preenchidos
    if(!nome || !endereco || !email || !telefone || !cpf){
      setErro("Preencha todos os campos.") // mostra erro
      return // interrompe execução
    }

    // Cria o objeto do novo paciente
    const novoPaciente = {
      id: Date.now(),      // cria um ID único
      nome: nome,          // nome digitado
      endereco: endereco,  // endereço digitado
      email: email,        // email digitado
      telefone: telefone,  // telefone digitado
      cpf: cpf             // CPF digitado
    }

    // Envia o novo paciente para o App.jsx (onde fica armazenado)
    adicionarPaciente(novoPaciente)

    // Mostra mensagem de sucesso
    setSucesso("Paciente cadastrado com sucesso!")

    // Limpa os campos após cadastro
    setNome("")
    setEndereco("")
    setEmail("")
    setTelefone("")
    setCpf("")
  }    

  // Interface da tela
  return( 
    <div>

      {/* Título da página */}
      <h1>Pacientes</h1>
      <h2>Cadastro de Pacientes</h2>
      
      {/* Input do nome */}
      <input 
        type="text" 
        placeholder="Nome do Paciente"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      {/* Input do endereço */}
      <input 
        type="text" 
        placeholder="Endereço"
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
      />

      {/* Input do e-mail */}
      <input 
        type="text" 
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* Input do telefone */}
      <input 
        type="text" 
        placeholder="Telefone"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
      />   

      {/* Input do CPF */}
      <input 
        type="text"
        placeholder="CPF"
        value={cpf}
        onChange={(e) => setCpf(e.target.value)}
      />

      {/* Botão que chama a função de cadastro */}
      <button onClick={confirmar_dados}>Cadastrar Paciente</button>

      {/* Botão para voltar */}
      <button onClick={voltar_dashboard}>Voltar</button>

      {/* Exibe erro somente se existir */}
      {erro && <p style={{color: "red"}}>{erro}</p>}

      {/* Exibe sucesso somente se existir */}
      {sucesso && <p style={{color: "green"}}>{sucesso}</p>}

    </div>
  )
}

// Exporta o componente
export default Pacientes