import { useState } from "react"
import { useNavigate } from "react-router-dom"

function Login() {
  const[ra, setRa] = useState("")
  const[senha, setSenha] = useState("")
  const[erro, setErro] = useState("")
  const[login, setLogin] = useState("")
  const[logado, setLogado] = useState("")
  const navigate = useNavigate()
  function entrar(){
    if(!ra || !senha){//validação para ver se o usuário digitou nos campos
      setErro("Preencha todos os campos.")
      setLogin("")
      setLogado(false)
      return
      }
    if(ra === "123" && senha === "123"){
        navigate("/Dashboard")
        setLogin("Login realizado com sucesso!")
        setErro("") 
      setRa("") 
      setSenha("")
      setLogado(true)
    }else{
      setErro("RA ou senha inválidos")}
      setLogin("")
  
  
  
  setErro("")    
  console.log("RA: ", ra)
  console.log("Senha: ", senha)
  
}

  return(
  <div>
    <h1>Login</h1>

    <input type="text" //aqui o usuario irá digitar o RA 
    placeholder="Digite seu RA"
    value={ra}
    onChange={(e) =>  setRa(e.target.value)}//pega oque o usuário está digitando
    />

    <input type="password" //usuário digitará a senha
    placeholder="Digite sua senha"
    value={senha}
    onChange={(e) => setSenha(e.target.value)}//pega oque o usuário está digitando
    />
    <button onClick={entrar}>Entrar</button>
    {erro && <p style={{color: "red"}}>{erro}</p>}
    {login && <p style={{color: "green"}}>{login}</p>} 
    {logado && <h2 style={{color:"blue" }}>Bem vindo ao sistema</h2>} 
  </div>

)}

export default Login