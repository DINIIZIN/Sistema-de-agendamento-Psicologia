import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CadastroMedico = ({ usuarioLogadoId }) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    ra: '',
    senha: '',
    perfil: 'MEDICO',
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
        setSucesso('Médico Master cadastrado com sucesso!');
        setTimeout(() => navigate('/'), 1500);
      } else {
        setErro(data.error || 'Não foi possível cadastrar o Médico.');
      }
    } catch (err) {
      console.error("Erro na comunicação com a API", err);
      setErro('Erro ao conectar com o servidor.');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', border: '2px solid #007bff', borderRadius: '10px' }}>
      <h2 style={{ textAlign: 'center', color: '#007bff' }}>Cadastro de Médico Master</h2>
      <p style={{ fontSize: '0.9em', color: '#666' }}>* O sistema permite apenas um Médico Master cadastrado.</p>

      <form onSubmit={handleSubmit}>

        <div style={{ marginBottom: '12px' }}>
          <label>Nome Completo:</label>
          <input type="text" name="nome" value={formData.nome} onChange={handleChange} required style={inputStyle} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>E-mail:</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required style={inputStyle} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Telefone:</label>
          <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>RA (Registro Acadêmico/ID):</label>
          <input type="text" name="ra" value={formData.ra} onChange={handleChange} required style={inputStyle} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Senha de Acesso:</label>
          <input type="password" name="senha" value={formData.senha} onChange={handleChange} required style={inputStyle} />
        </div>

        <button type="submit" style={buttonStyle}>Finalizar Cadastro Master</button>
        <button type="button" onClick={() => navigate('/')} style={{ ...buttonStyle, backgroundColor: '#6c757d', marginTop: '8px' }}>
          Voltar
        </button>

      </form>

      {erro && <p style={{ color: 'red', marginTop: '10px' }}>{erro}</p>}
      {sucesso && <p style={{ color: 'green', marginTop: '10px' }}>{sucesso}</p>}
    </div>
  );
};

const inputStyle = { width: '100%', padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' };
const buttonStyle = { width: '100%', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };

export default CadastroMedico;
