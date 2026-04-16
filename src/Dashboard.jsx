import { useState } from "react";
import { useNavigate } from "react-router-dom";
function Dashboard(){
const navigate = useNavigate()
    function sair(){
        navigate("/")
    }
    function Agendamento(){
        navigate("/Agendamentos")
    }

    function Pacientes(){
        navigate("/Pacientes")
    }
    return( <div>
    <h1>Software de agendamento de clientes</h1>
    <button onClick={Agendamento}>Agendamento</button>
    <button onClick={Pacientes}>Pacientes</button>
    <button onClick={sair}>Sair</button>
        
    </div>
) 
}


export default Dashboard
