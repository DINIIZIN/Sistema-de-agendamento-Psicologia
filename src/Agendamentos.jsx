import { useState } from "react"
import { useNavigate } from "react-router-dom"


function Agendamentos(){
    
    const navigate = useNavigate()
    function voltar_dashboard(){
        navigate("/Dashboard")
    }

return(  
<div> 
    <h1>Meus Agendamentos</h1>
    <button onClick={voltar_dashboard}>Voltar</button>
    </div>
)
}

export default Agendamentos