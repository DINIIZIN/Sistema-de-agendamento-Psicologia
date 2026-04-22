// Importa os componentes necessários para criar rotas no React
import { BrowserRouter, Routes, Route } from "react-router-dom"

// Importa o useState para gerenciar estados (dados) dentro do componente
import { useState } from "react"

// Importa as páginas do sistema
import Login from "./Login"
import Dashboard from "./Dashboard"
import Pacientes from "./Pacientes"
import Agendamentos from "./Agendamentos"

// Componente principal da aplicação (ponto de entrada da lógica do sistema)
function App(){

  // Estado que guarda a lista de pacientes cadastrados
  // Começa vazio []
  const [pacientes, setPacientes] = useState([])

  // Estado que guarda a lista de agendamentos realizados
  // Também começa vazio []
  const [agendamentos, setAgendamentos] = useState([])
 
  // Função responsável por adicionar um novo agendamento na lista
  function adicionarAgendamento(novoAgendamento){

    // Atualiza o estado:
    // pega a lista atual de agendamentos
    // e adiciona o novo no final
    setAgendamentos([...agendamentos, novoAgendamento])
  }

  // Função responsável por adicionar um novo paciente na lista
  function adicionarPaciente(novoPaciente){

    // Atualiza o estado:
    // pega a lista atual de pacientes
    // e adiciona o novo no final
    setPacientes([...pacientes, novoPaciente])
  }   

  // Retorno do componente (o que será renderizado na tela)
  return(

  // Envolve toda a aplicação com o sistema de rotas
  <BrowserRouter>

    {/* Define todas as rotas do sistema */}
    <Routes>

      {/* Rota inicial "/" → tela de Login */}
      <Route path="/" element={<Login/>}/>

      {/* Rota do Dashboard */}
      <Route path="/Dashboard" element={<Dashboard/>}/>

      {/* Rota de Pacientes */}
      <Route 
        path="/Pacientes" 
        element={
          <Pacientes 
            // Envia a função para cadastrar novos pacientes
            adicionarPaciente={adicionarPaciente} 

            // (opcional) está sendo enviada também, mas normalmente não precisa aqui
            adicionarAgendamento={adicionarAgendamento}
          />
        }
      />

      {/* Rota de Agendamentos */}
      <Route 
        path="/Agendamentos" 
        element={
          <Agendamentos 

            // Envia a lista de pacientes para a tela de agendamento
            pacientes={pacientes}

            // Envia a lista de agendamentos já feitos
            agendamentos={agendamentos}

            // Envia a função para criar novos agendamentos
            adicionarAgendamento={adicionarAgendamento}
          />
        }
      />  

    </Routes>
    
  </BrowserRouter>
  )
}

// Exporta o componente App para ser usado no sistema
export default App