import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CadastroEstagiario = ({ usuarioLogadoId }) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    ra: '',
    senha: '',
    perfil: 'ESTAGIARIO',
  });

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!formData.nome || !formData.ra || !formData.senha) {
      setErro('Nome, RA e senha são obrigatórios.');
      return;
    }

    const payload = {
      ...formData,
      criado_por_id: usuarioLogadoId || null,
    };

    try {
      const response = await fetch('http://localhost:3001/api/estagiarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSucesso('Usuário cadastrado com sucesso! Redirecionando...');
        setFormData({ nome: '', email: '', telefone: '', ra: '', senha: '', perfil: 'ESTAGIARIO' });
        setTimeout(() => navigate('/'), 1500);
      } else {
        setErro(data.error || 'Erro ao cadastrar.');
      }
    } catch (err) {
      console.error("Erro na comunicação com a API", err);
      setErro('Erro ao conectar com o servidor.');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>Cadastro de Usuário</h2>

      <form onSubmit={handleSubmit}>

        <div style={{ marginBottom: '10px' }}>
          <label>Nome Completo: *</label>
          <input type="text" name="nome" value={formData.nome} onChange={handleChange} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>E-mail:</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Telefone:</label>
          <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>RA (Login): *</label>
          <input type="text" name="ra" value={formData.ra} onChange={handleChange} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Senha: *</label>
          <input type="password" name="senha" value={formData.senha} onChange={handleChange} required style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>Perfil:</label>
          <select name="perfil" value={formData.perfil} onChange={handleChange} style={{ width: '100%' }}>
            <option value="ESTAGIARIO">Estagiário</option>
            <option value="MEDICO">Médico Master</option>
          </select>
        </div>

         <button type="submit" style={{ width: '100%', padding: '10px' }}>Cadastrar</button>
        <button type="button" onClick={() => navigate('/')} style={{ width: '100%', padding: '10px', marginTop: '8px' }}>
          Voltar ao Login
        </button>

      </form>

      {erro && <p style={{ color: 'red', marginTop: '10px' }}>{erro}</p>}
      {sucesso && <p style={{ color: 'green', marginTop: '10px' }}>{sucesso}</p>}
    </div>
  );
};

export default CadastroEstagiario;
