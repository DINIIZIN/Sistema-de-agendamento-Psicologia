// ============================================================
// Login.jsx — tela de login e recuperação de senha
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ setUsuarioLogado }) {
  // Estados dos campos do formulário de login
  const [ra, setRa] = useState("");
  const [senha, setSenha] = useState("");

  // Estado do campo de e-mail (usado na tela de recuperação de senha)
  const [email, setEmail] = useState("");

  // Mensagens de feedback para o usuário
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Controla qual tela está sendo exibida: 'login', 'forgot' ou 'forgot_enviado'
  const [tela, setTela] = useState("login");

  const navigate = useNavigate();

  // ============================================================
  // Função de login: envia RA e senha para a API
  // ============================================================
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
        // Salva o token JWT no localStorage para manter o login após recarregar
        localStorage.setItem("token", data.token);

        // Atualiza o estado global com os dados do usuário logado
        setUsuarioLogado({ id: data.id, nome: data.nome, perfil: data.perfil });

        // Redireciona baseado no perfil: MEDICO vai para o painel admin, estagiário para o dashboard
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

  // ============================================================
  // Função de recuperação de senha: envia e-mail para a API
  // ============================================================
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
        setTela("forgot_enviado"); // Muda para a tela de confirmação
      } else {
        setErro(data.error || "Erro ao solicitar recuperação.");
      }
    } catch {
      setErro("Servidor offline.");
    }
  }

  // ============================================================
  // TELA: Recuperação de senha (formulário e confirmação)
  // ============================================================
  if (tela === "forgot" || tela === "forgot_enviado") {
    return (
      <div style={{ maxWidth: 400, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Recuperar Senha</h2>
        {tela === "forgot_enviado" ? (
          <>
            {/* Confirmação de envio do link */}
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
            {/* Formulário para digitar o e-mail */}
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

  // ============================================================
  // TELA: Login principal
  // ============================================================
  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
      <h1>Login</h1>

      {/* Campo de RA (usado como identificador de login) */}
      <input
        type="text" placeholder="Digite seu RA"
        value={ra} onChange={(e) => setRa(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && entrar()} // Permite logar com Enter
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      {/* Campo de senha */}
      <input
        type="password" placeholder="Digite sua senha"
        value={senha} onChange={(e) => setSenha(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && entrar()} // Permite logar com Enter
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      {/* Botão principal de login */}
      <button onClick={entrar}
        style={{ width: "100%", padding: 12, marginBottom: 8, background: "#007bff", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 15 }}>
        Entrar
      </button>

      {/* Botão para ir para a tela de cadastro */}
      <button onClick={() => navigate("/cadastro-estagiario")}
        style={{ width: "100%", padding: 10, marginBottom: 8 }}>
        Cadastrar
      </button>

      {/* Link para recuperação de senha */}
      <button
        onClick={() => { setTela("forgot"); setErro(""); }}
        style={{ width: "100%", padding: 10, background: "none", border: "none", color: "#007bff", cursor: "pointer" }}>
        Esqueci minha senha
      </button>

      {/* Mensagem de erro (ex: credenciais inválidas, servidor offline) */}
      {erro && <p style={{ color: "red" }}>{erro}</p>}
    </div>
  );
}

export default Login;
