import {BrowserRouter, Routes, Route} from "react-router-dom"
import Login from "./Login"
import Dashboard from "./Dashboard"
import Pacientes from "./Pacientes"
import Agendamentos from "./Agendamentos"

function App(){
  return(
  <BrowserRouter>
    <Routes>
    
      <Route path="/" element={<Login/>}/>
      <Route path="/Dashboard" element={<Dashboard/>}/>
      <Route path="/Pacientes" element={<Pacientes/>}/>
      <Route path="Agendamentos" element={<Agendamentos/>}/>  
    </Routes>
    
  </BrowserRouter>
  )
}


export default App