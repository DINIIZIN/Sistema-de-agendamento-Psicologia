// ============================================================
// api.js — cliente HTTP centralizado para chamar o backend
// ============================================================
// Todas as chamadas para a API passam por aqui.
// Isso evita repetir a URL base e o header de autenticação em cada componente.

const BASE_URL = 'http://localhost:3001/api'; // Endereço base do servidor Node

// Retorna o token JWT salvo no localStorage (gerado no login)
function getToken() {
  return localStorage.getItem('token');
}

// Monta o header padrão com Content-Type JSON e o token de autenticação
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}` // Formato esperado pelo middleware autenticar()
  };
}

// Função genérica que faz a requisição e trata erros automaticamente
async function request(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined // Só serializa o body se existir
  });

  const data = await response.json();

  // Se o servidor retornou erro, lança uma exceção com o objeto de erro
  // Assim os componentes podem capturar com catch(err) e usar err.error
  if (!response.ok) throw data;

  return data;
}

// Atalhos para os métodos HTTP mais usados
export const api = {
  get: (path) => request('GET', path),                // Buscar dados
  post: (path, body) => request('POST', path, body),  // Criar registro
  put: (path, body) => request('PUT', path, body),    // Editar registro
  delete: (path) => request('DELETE', path),          // Deletar/cancelar registro
};
