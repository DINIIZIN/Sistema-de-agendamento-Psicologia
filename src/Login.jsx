import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ setUsuarioLogado }) {
  const [ra, setRa] = useState("");
  const [senha, setSenha] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [tela, setTela] = useState("login");
  const navigate = useNavigate();

  async function entrar() {
    if (!ra || !senha) { setErro("Preencha todos os campos."); return; }
    setErro("");
    try {
      const res = await fetch("http://localhost:3001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ra, senha }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        setUsuarioLogado({ id: data.id, nome: data.nome, perfil: data.perfil });
        // Redireciona para /admin se for MEDICO, senão para /Dashboard
        if (data.perfil === "MEDICO") {
          navigate("/admin");
        } else {
          navigate("/Dashboard");
        }
      } else {
        setErro(data.error || "Erro ao fazer login.");
      }
    } catch {
      setErro("Servidor offline. Verifique se o servidor está rodando.");
    }
  }

  async function solicitarRecuperacao() {
    if (!email) { setErro("Informe seu e-mail."); return; }
    setErro("");
    try {
      const res = await fetch("http://localhost:3001/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSucesso(data.message);
        setTela("forgot_enviado");
      } else {
        setErro(data.error || "Erro ao solicitar recuperação.");
      }
    } catch {
      setErro("Servidor offline.");
    }
  }

  if (tela === "forgot" || tela === "forgot_enviado") {
    return (
      <div style={{ maxWidth: 400, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Recuperar Senha</h2>
        {tela === "forgot_enviado" ? (
          <>
            <p style={{ color: "green" }}>{sucesso}</p>
            <p style={{ fontSize: "0.9em", color: "#666" }}>
              Verifique o console do servidor para o link (em desenvolvimento).
            </p>
            <button onClick={() => { setTela("login"); setSucesso(""); }}
              style={{ width: "100%", padding: 10 }}>
              Voltar ao Login
            </button>
          </>
        ) : (
          <>
            <input
              type="email" placeholder="Seu e-mail cadastrado"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 10 }}
            />
            <button onClick={solicitarRecuperacao}
              style={{ width: "100%", padding: 10, marginBottom: 8 }}>
              Enviar Link de Recuperação
            </button>
            <button onClick={() => { setTela("login"); setErro(""); }}
              style={{ width: "100%", padding: 10 }}>
              Voltar
            </button>
            {erro && <p style={{ color: "red" }}>{erro}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
      <h1>Login</h1>
      <input
        type="text" placeholder="Digite seu RA"
        value={ra} onChange={(e) => setRa(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && entrar()}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />
      <input
        type="password" placeholder="Digite sua senha"
        value={senha} onChange={(e) => setSenha(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && entrar()}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />
      <button onClick={entrar}
        style={{ width: "100%", padding: 12, marginBottom: 8, background: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 15 }}>
        Entrar
      </button>
      <button onClick={() => navigate("/cadastro-estagiario")}
        style={{ width: "100%", padding: 10, marginBottom: 8 }}>
        Cadastrar
      </button>
      <button
        onClick={() => { setTela("forgot"); setErro(""); }}
        style={{ width: "100%", padding: 10, background: "none", border: "none", color: "#007bff", cursor: "pointer" }}>
        Esqueci minha senha
      </button>
      {erro && <p style={{ color: "red" }}>{erro}</p>}
    </div>
  );
}

export default Login;
