import { useState } from "react"
import { useNavigate } from "react-router-dom"

function Pacientes() {
const[nome, setNome] = useState("")
const[endereco, setEndereco] = useState("")


const navigate = useNavigate()
function voltar_dashboard(){
navigate("/Dashboard")
}
    return( 
    <div>
    <h1>Pacientes</h1>
    <h2>Cadastro de Pacientes</h2>
    <input type="text" 
    placeholder="Nome do Paciente"
    value={nome}
    onChange={(e) => setNome(e.target.value)}
     />
     <input type="text" 
     placeholder="Endereço"
     value={endereco}
     onChange={(e) => setEndereco(e.target.value)}/>
    <button onClick={voltar_dashboard}>Voltar</button>

</div>
)
}

export default Pacientes