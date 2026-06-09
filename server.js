// ============================================================
// IMPORTAÇÕES — bibliotecas usadas no servidor
// ============================================================
import express from 'express';       // Framework web para criar as rotas HTTP
import sqlite3 from 'sqlite3';       // Banco de dados SQLite (arquivo local)
import cors from 'cors';             // Permite que o frontend acesse a API de outra porta
import crypto from 'crypto';         // Gera tokens seguros para recuperação de senha
import bcrypt from 'bcrypt';         // Criptografa senhas antes de salvar no banco
import jwt from 'jsonwebtoken';      // Cria e valida tokens de autenticação (JWT)
import dotenv from 'dotenv';         // Carrega variáveis de ambiente do arquivo .env
dotenv.config();
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY);
// Carrega as variáveis do .env (ex: JWT_SECRET)

// Cria a aplicação Express
const app = express();
app.use(express.json()); // Permite ler JSON no corpo das requisições
app.use(cors());         // Libera acesso de qualquer origem (necessário para o frontend React)

// ============================================================
// CONSTANTES — configurações globais do sistema
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET;           // Chave secreta lida do .env para assinar os tokens
const SALT_ROUNDS = 10;                              // Quantas rodadas de hash o bcrypt usa (mais = mais seguro e lento)
const MAX_PACIENTES_POR_ESTAGIARIO = 3;              // Limite de pacientes que cada estagiário pode ter
const MAX_SESSOES_POR_PACIENTE = 10;                 // Limite de sessões agendadas por paciente

// ============================================================
// BANCO DE DADOS — conexão e criação das tabelas
// ============================================================
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error("Erro ao abrir banco:", err.message);
  } else {
    console.log("Conectado ao SQLite V7.1 (WAL Mode On)");

    // WAL mode melhora a performance em leituras e escritas simultâneas
    db.run("PRAGMA journal_mode = WAL;");

    // Garante que as chaves estrangeiras (FK) sejam respeitadas
    db.run("PRAGMA foreign_keys = ON;");

    // db.serialize() garante que os CREATEs rodem em ordem, um por vez
    db.serialize(() => {

      // Tabela de estagiários (também usada para o admin/médico)
      db.run(`CREATE TABLE IF NOT EXISTS estagiarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT,
        telefone TEXT,
        ra TEXT NOT NULL UNIQUE,   -- RA é o login, deve ser único
        senha TEXT NOT NULL,       -- Senha armazenada como hash bcrypt
        perfil TEXT NOT NULL DEFAULT 'ESTAGIARIO', -- 'ESTAGIARIO' ou 'MEDICO'
        criado_por_id INTEGER      -- ID de quem criou o registro (opcional)
      )`);

      // Tabela de pacientes cadastrados pelos estagiários
      db.run(`CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_enc TEXT NOT NULL,             -- Nome do paciente
        cpf_hash TEXT,                      -- CPF do paciente
        endereco TEXT,
        email TEXT,
        telefone TEXT,
        data_nascimento TEXT,               -- Data de nascimento (para detectar menores de idade)
        responsavel_nome TEXT,              -- Nome do responsável legal (obrigatório para menores)
        responsavel_telefone TEXT,          -- Telefone do responsável
        cadastrado_por_estagiario_id INTEGER,
        FOREIGN KEY (cadastrado_por_estagiario_id) REFERENCES estagiarios(id)
      )`);

      // ALTER TABLE adiciona as colunas novas caso o banco já existia sem elas
      // O callback vazio () => {} evita erro caso a coluna já exista
      db.run(`ALTER TABLE pacientes ADD COLUMN data_nascimento TEXT`, () => {});
      db.run(`ALTER TABLE pacientes ADD COLUMN responsavel_nome TEXT`, () => {});
      db.run(`ALTER TABLE pacientes ADD COLUMN responsavel_telefone TEXT`, () => {});

      // Tabela de agendamentos de sessões
      db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        estagiario_id INTEGER NOT NULL,
        sala_id INTEGER,                        -- Número da sala (1 a 7)
        data_inicio TEXT NOT NULL,              -- Data e hora agendada (formato: 'YYYY-MM-DD HH:MM')
        status TEXT NOT NULL DEFAULT 'AGENDADO', -- 'AGENDADO' ou 'CANCELADO'
        sessao_iniciada INTEGER DEFAULT 0,      -- 0 = não iniciada, 1 = iniciada (confirmada por geolocalização)
        data_inicio_real TEXT,                  -- Hora real em que o estagiário clicou em "Iniciar Sessão"
        ultimo_editor_id INTEGER,               -- ID de quem editou o agendamento por último
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY (estagiario_id) REFERENCES estagiarios(id)
      )`);

      // Adiciona colunas novas ao banco existente sem quebrar dados anteriores
      db.run(`ALTER TABLE agendamentos ADD COLUMN sessao_iniciada INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE agendamentos ADD COLUMN data_inicio_real TEXT`, () => {});

      // Índice único: impede duas sessões na mesma sala no mesmo horário
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_conflito_sala_horario
        ON agendamentos (sala_id, data_inicio) WHERE status = 'AGENDADO'`);

      // Índice único: impede o mesmo paciente ter duas sessões no mesmo horário
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_paciente_conflito_horario
        ON agendamentos (paciente_id, data_inicio) WHERE status = 'AGENDADO'`);

      // Tabela de tokens para recuperação de senha por e-mail
      db.run(`CREATE TABLE IF NOT EXISTS tokens_recuperacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estagiario_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,              -- Token armazenado como hash SHA-256 (nunca o token bruto)
        expira_em TEXT NOT NULL,               -- Data/hora de expiração (1 hora após geração)
        usado INTEGER NOT NULL DEFAULT 0,      -- 0 = ainda válido, 1 = já utilizado
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (estagiario_id) REFERENCES estagiarios(id)
      )`);
    });
  }
});

// ============================================================
// MIDDLEWARES DE AUTENTICAÇÃO
// ============================================================

// autenticar: verifica se o token JWT no header é válido
// Usado como middleware nas rotas que exigem login
function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato esperado: "Bearer <token>"
  if (!token) return res.status(401).json({ error: "Acesso negado. Faça login." });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET); // Decodifica o token e salva em req.usuario
    next(); // Passa para o próximo handler
  } catch {
    res.status(403).json({ error: "Token inválido ou expirado. Faça login novamente." });
  }
}

// apenasAdmin: garante que só o perfil MEDICO acesse certas rotas
// Sempre usado após autenticar
function apenasAdmin(req, res, next) {
  if (req.usuario.perfil !== 'MEDICO') return res.status(403).json({ error: "Acesso restrito ao Médico Master." });
  next();
}

// ============================================================
// ROTA: LOGIN
// ============================================================
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: "RA e senha são obrigatórios." });

  // Busca o usuário pelo RA no banco
  db.get(`SELECT id, nome, perfil, senha FROM estagiarios WHERE ra = ?`, [ra], async (err, user) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (!user) return res.status(401).json({ error: "RA ou senha inválidos." }); // Mensagem genérica para não revelar se o RA existe

    try {
      // bcrypt.compare compara a senha digitada com o hash salvo no banco
      const senhaCorreta = await bcrypt.compare(senha, user.senha);
      if (!senhaCorreta) return res.status(401).json({ error: "RA ou senha inválidos." });

      // Gera um token JWT válido por 8 horas com os dados do usuário
      const token = jwt.sign(
        { id: user.id, nome: user.nome, perfil: user.perfil },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      res.json({ token, id: user.id, nome: user.nome, perfil: user.perfil });
    } catch {
      res.status(500).json({ error: "Erro ao verificar senha." });
    }
  });
});

// ============================================================
// ROTA: CADASTRAR ESTAGIÁRIO (rota pública — não exige login)
// ============================================================
app.post('/api/estagiarios', async (req, res) => {
  const { nome, email, telefone, ra, senha, perfil, criado_por_id } = req.body;
  if (!nome || !ra || !senha) return res.status(400).json({ error: "Nome, RA e senha são obrigatórios." });
  if (senha.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });

  try {
    // Gera o hash da senha antes de salvar (nunca salva senha em texto puro)
    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    db.run(
      `INSERT INTO estagiarios (nome, email, telefone, ra, senha, perfil, criado_por_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, email, telefone, ra, senhaHash, perfil || 'ESTAGIARIO', criado_por_id || null],
      function (err) {
        if (err) {
          // Erro UNIQUE indica que o RA já está cadastrado
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: "Já existe um usuário com esse RA." });
          return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: "Usuário cadastrado com sucesso!" });
      }
    );
  } catch {
    res.status(500).json({ error: "Erro ao processar senha." });
  }
});

// ============================================================
// ROTA: LISTAR ESTAGIÁRIOS (apenas admin)
// ============================================================
app.get('/api/estagiarios', autenticar, apenasAdmin, (req, res) => {
  // Retorna todos os estagiários sem expor a senha
  db.all("SELECT id, nome, email, telefone, ra, perfil FROM estagiarios", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ============================================================
// ROTA: BUSCAR ESTAGIÁRIO POR ID
// ============================================================
app.get("/api/estagiarios/:id", autenticar, (req, res) => {
  const { id } = req.params;
  // Estagiário só pode ver seus próprios dados; admin pode ver qualquer um
  if (req.usuario.perfil !== 'MEDICO' && req.usuario.id !== parseInt(id))
    return res.status(403).json({ error: "Acesso negado." });

  db.get(`SELECT id, nome, email, telefone, ra, perfil FROM estagiarios WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(row);
  });
});

// ============================================================
// ROTA: DELETAR ESTAGIÁRIO (apenas admin)
// ============================================================
app.delete('/api/estagiarios/:id', autenticar, apenasAdmin, (req, res) => {
  const { id } = req.params;

  // Proteção: o admin não pode deletar a própria conta
  if (req.usuario.id === parseInt(id))
    return res.status(400).json({ error: "Você não pode deletar sua própria conta." });

  db.run(`DELETE FROM estagiarios WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Estagiário não encontrado." });
    res.json({ message: "Estagiário deletado com sucesso!" });
  });
});

// ============================================================
// ROTA: EDITAR ESTAGIÁRIO
// ============================================================
app.put('/api/estagiarios/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone } = req.body;
  // Estagiário só pode editar seus próprios dados; admin pode editar qualquer um
  if (req.usuario.perfil !== 'MEDICO' && req.usuario.id !== parseInt(id))
    return res.status(403).json({ error: "Acesso negado." });

  db.run(`UPDATE estagiarios SET nome = ?, email = ?, telefone = ? WHERE id = ?`, [nome, email, telefone, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ message: "Dados atualizados com sucesso!" });
  });
});

// ============================================================
// ROTA: LISTAR PACIENTES
// ============================================================
app.get('/api/pacientes', autenticar, (req, res) => {
  const isAdmin = req.usuario.perfil === 'MEDICO';

  // Admin vê todos os pacientes; estagiário vê apenas os seus
  const sql = isAdmin
    ? `SELECT id, nome_enc as nome, cpf_hash as cpf, endereco, email, telefone, data_nascimento, responsavel_nome, responsavel_telefone, cadastrado_por_estagiario_id as estagiario_id FROM pacientes ORDER BY nome_enc`
    : `SELECT id, nome_enc as nome, cpf_hash as cpf, endereco, email, telefone, data_nascimento, responsavel_nome, responsavel_telefone, cadastrado_por_estagiario_id as estagiario_id FROM pacientes WHERE cadastrado_por_estagiario_id = ? ORDER BY nome_enc`;
  const params = isAdmin ? [] : [req.usuario.id];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ============================================================
// ROTA: CADASTRAR PACIENTE
// ============================================================
app.post('/api/pacientes', autenticar, (req, res) => {
  const { nome, cpf, endereco, email, telefone, data_nascimento, responsavel_nome, responsavel_telefone } = req.body;
  const estagiario_id = req.usuario.id; // O estagiário logado é dono do paciente
  if (!nome) return res.status(400).json({ error: "Nome do paciente é obrigatório." });

  // Valida responsável para menores de idade: calcula a idade e exige dados do responsável
  if (data_nascimento) {
    const idade = Math.floor((new Date() - new Date(data_nascimento)) / (365.25 * 24 * 60 * 60 * 1000));
    if (idade < 18 && !responsavel_nome)
      return res.status(400).json({ error: "Paciente menor de idade requer nome do responsável." });
  }

  // Verifica se o estagiário já atingiu o limite de pacientes
  db.get(`SELECT COUNT(*) as total FROM pacientes WHERE cadastrado_por_estagiario_id = ?`, [estagiario_id], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (row.total >= MAX_PACIENTES_POR_ESTAGIARIO)
      return res.status(400).json({ error: `Limite atingido. Máximo de ${MAX_PACIENTES_POR_ESTAGIARIO} pacientes por estagiário.` });

    db.run(
      `INSERT INTO pacientes (nome_enc, cpf_hash, endereco, email, telefone, data_nascimento, responsavel_nome, responsavel_telefone, cadastrado_por_estagiario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, cpf, endereco, email, telefone, data_nascimento || null, responsavel_nome || null, responsavel_telefone || null, estagiario_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: "Paciente cadastrado com sucesso!" });
      }
    );
  });
});

// ============================================================
// ROTA: EDITAR PACIENTE
// ============================================================
app.put('/api/pacientes/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const { nome, cpf, endereco, email, telefone, data_nascimento, responsavel_nome, responsavel_telefone } = req.body;

  // Verifica se o paciente existe e se o usuário tem permissão para editá-lo
  db.get(`SELECT cadastrado_por_estagiario_id FROM pacientes WHERE id = ?`, [id], (err, paciente) => {
    if (err) return res.status(500).json({ error: "Erro interno." });
    if (!paciente) return res.status(404).json({ error: "Paciente não encontrado." });
    if (req.usuario.perfil !== 'MEDICO' && paciente.cadastrado_por_estagiario_id !== req.usuario.id)
      return res.status(403).json({ error: "Você não tem permissão para editar este paciente." });

    db.run(
      `UPDATE pacientes SET nome_enc = ?, cpf_hash = ?, endereco = ?, email = ?, telefone = ?, data_nascimento = ?, responsavel_nome = ?, responsavel_telefone = ? WHERE id = ?`,
      [nome, cpf, endereco, email, telefone, data_nascimento || null, responsavel_nome || null, responsavel_telefone || null, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Paciente atualizado com sucesso!" });
      }
    );
  });
});

// ============================================================
// ROTA: SALAS DISPONÍVEIS POR DATA/HORA
// ============================================================
app.get('/api/salas-disponiveis', autenticar, (req, res) => {
  const { data_inicio } = req.query;
  if (!data_inicio) return res.status(400).json({ error: "data_inicio é obrigatório." });

  // Busca quais salas já estão ocupadas naquele horário
  db.all(
    `SELECT sala_id FROM agendamentos 
     WHERE data_inicio = ? AND status = 'AGENDADO'`,
    [data_inicio],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Erro interno no servidor." });
      console.log('[SALAS] Buscando:', data_inicio, '| Ocupadas:', rows);
      res.json({ salasOcupadas: rows.map(r => r.sala_id) }); // Retorna array com IDs das salas ocupadas
    }
  );
});

// ============================================================
// ROTA: CRIAR AGENDAMENTO
// ============================================================
app.post('/api/agendamentos', autenticar, (req, res) => {
  const { paciente_id, sala_id, data_inicio } = req.body;
  const estagiario_id = req.usuario.id;
  if (!paciente_id || !data_inicio || !sala_id)
    return res.status(400).json({ error: "Paciente, sala e data são obrigatórios." });

  // Verifica se o paciente existe e pertence ao estagiário logado
  db.get(`SELECT cadastrado_por_estagiario_id FROM pacientes WHERE id = ?`, [paciente_id], (err, paciente) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (!paciente) return res.status(404).json({ error: "Paciente não encontrado." });
    if (req.usuario.perfil !== 'MEDICO' && paciente.cadastrado_por_estagiario_id !== estagiario_id)
      return res.status(403).json({ error: "Este paciente não pertence a você." });

    // Verifica se o paciente ainda tem sessões disponíveis
   db.get(
  `SELECT COUNT(*) as total FROM agendamentos WHERE paciente_id = ? AND estagiario_id = ? AND status IN ('AGENDADO', 'CONCLUIDO')`,
  [paciente_id, estagiario_id],
  (err, row) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (!row) return res.status(500).json({ error: "Erro ao contar sessões." });
    if (row.total >= MAX_SESSOES_POR_PACIENTE)
      return res.status(400).json({ error: `Limite atingido. Máximo de ${MAX_SESSOES_POR_PACIENTE} sessões por paciente.` });
        // Verifica se o paciente já tem sessão no mesmo dia (regra de negócio)
        const dataApenas = data_inicio.split(' ')[0];
        db.get(
          `SELECT id FROM agendamentos WHERE paciente_id = ? AND date(data_inicio) = date(?) AND status = 'AGENDADO'`,
          [paciente_id, dataApenas],
          (err, conflitoDia) => {
            if (err) return res.status(500).json({ error: "Erro interno no servidor." });
            if (conflitoDia) return res.status(400).json({ error: "Paciente já possui agendamento para este dia." });

            // Insere o agendamento (o índice UNIQUE do banco protege contra conflito de sala/horário)
            db.run(
              `INSERT INTO agendamentos (paciente_id, estagiario_id, sala_id, data_inicio, status, ultimo_editor_id) VALUES (?, ?, ?, ?, 'AGENDADO', ?)`,
              [paciente_id, estagiario_id, sala_id, data_inicio, estagiario_id],
              function (err) {
                if (err) {
                  if (err.message.includes('UNIQUE constraint failed'))
                    return res.status(400).json({ error: "Conflito de horário: sala ou paciente já ocupados neste horário." });
                  return res.status(500).json({ error: "Erro interno no servidor." });
                }
                res.status(201).json({ id: this.lastID, message: "Agendamento realizado com sucesso!" });
              }
            );
          }
        );
      }
    );
  });
});

// ============================================================
// ROTA: LISTAR AGENDAMENTOS
// ============================================================
app.get('/api/agendamentos', autenticar, (req, res) => {
  const isAdmin = req.usuario.perfil === 'MEDICO';

  // Admin vê todos os agendamentos; estagiário vê só os seus
  // JOIN com pacientes e estagiários para retornar os nomes junto
  const sql = isAdmin
    ? `SELECT a.id, a.data_inicio, a.sala_id, a.paciente_id, a.estagiario_id, a.status, a.sessao_iniciada, a.data_inicio_real,
             p.nome_enc as nomePaciente, e.nome as nomeEstagiario
       FROM agendamentos a
       JOIN pacientes p ON a.paciente_id = p.id
       JOIN estagiarios e ON a.estagiario_id = e.id
       ORDER BY a.data_inicio DESC`
    : `SELECT a.id, a.data_inicio, a.sala_id, a.paciente_id, a.estagiario_id, a.status, a.sessao_iniciada, a.data_inicio_real,
             p.nome_enc as nomePaciente, e.nome as nomeEstagiario
       FROM agendamentos a
       JOIN pacientes p ON a.paciente_id = p.id
       JOIN estagiarios e ON a.estagiario_id = e.id
       WHERE a.estagiario_id = ?
       ORDER BY a.data_inicio DESC`;
  const params = isAdmin ? [] : [req.usuario.id];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ============================================================
// ROTA: EDITAR AGENDAMENTO
// ============================================================
app.put('/api/agendamentos/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const { sala_id, data_inicio } = req.body;

  // Verifica se o agendamento existe e se o usuário tem permissão
  db.get(`SELECT estagiario_id, paciente_id FROM agendamentos WHERE id = ?`, [id], (err, ag) => {
    if (err) return res.status(500).json({ error: "Erro interno." });
    if (!ag) return res.status(404).json({ error: "Agendamento não encontrado." });
    if (req.usuario.perfil !== 'MEDICO' && ag.estagiario_id !== req.usuario.id)
      return res.status(403).json({ error: "Você não tem permissão para editar este agendamento." });

    // Verifica conflito de dia para o mesmo paciente (ignora o próprio agendamento)
    const dataApenas = data_inicio.split(' ')[0];
    db.get(
      `SELECT id FROM agendamentos WHERE paciente_id = ? AND date(data_inicio) = date(?) AND status = 'AGENDADO' AND id != ?`,
      [ag.paciente_id, dataApenas, id],
      (err, conflitoDia) => {
        if (err) return res.status(500).json({ error: "Erro interno no servidor." });
        if (conflitoDia) return res.status(400).json({ error: "Paciente já possui agendamento para este dia." });

        db.run(
          `UPDATE agendamentos SET sala_id = ?, data_inicio = ?, ultimo_editor_id = ? WHERE id = ?`,
          [sala_id, data_inicio, req.usuario.id, id],
          function (err) {
            if (err) {
              if (err.message.includes('UNIQUE constraint failed'))
                return res.status(400).json({ error: "Conflito de horário: sala já ocupada neste horário." });
              return res.status(500).json({ error: err.message });
            }
            res.json({ message: "Agendamento atualizado com sucesso!" });
          }
        );
      }
    );
  });
});

// ============================================================
// ROTA: INICIAR SESSÃO (com geolocalização)
// ============================================================

// Coordenadas da Estácio Santo Amaro (R. Promotor Gabriel Nettuzzi Perez, 108)
const CLINICA_LAT = -23.6522299;
const CLINICA_LNG = -46.7043886;
const RAIO_METROS = 150; // Raio máximo permitido para iniciar sessão

// Fórmula de Haversine: calcula a distância em metros entre dois pontos geográficos
function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

app.post('/api/agendamentos/:id/iniciar', autenticar, (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body; // Coordenadas enviadas pelo frontend

  // Garante que a localização foi enviada
  if (!latitude || !longitude)
    return res.status(400).json({ error: "Localização não fornecida. Permita o acesso à sua localização." });

  // Calcula a distância entre o estagiário e a clínica
  const distancia = calcularDistancia(latitude, longitude, CLINICA_LAT, CLINICA_LNG);

  // Bloqueia se o estagiário estiver fora do raio permitido
  //if (distancia > RAIO_METROS)
    //return res.status(403).json({ error: `Você está a ${Math.round(distancia)}m da clínica. É necessário estar a menos de ${RAIO_METROS}m para iniciar a sessão.` });

  db.get(`SELECT * FROM agendamentos WHERE id = ?`, [id], (err, ag) => {
    if (err) return res.status(500).json({ error: "Erro interno." });
    if (!ag) return res.status(404).json({ error: "Agendamento não encontrado." });
    if (ag.estagiario_id !== req.usuario.id && req.usuario.perfil !== 'MEDICO')
      return res.status(403).json({ error: "Sem permissão." });
    if (ag.sessao_iniciada)
      return res.status(400).json({ error: "Sessão já foi iniciada." });

    // Registra o horário real de início e marca sessao_iniciada = 1
    const agora = new Date().toISOString().replace('T', ' ').substring(0, 16);
    db.run(
      `UPDATE agendamentos SET sessao_iniciada = 1, data_inicio_real = ? WHERE id = ?`,
      [agora, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Sessão iniciada com sucesso!", data_inicio_real: agora });
      }
    );
  });
});

// ============================================================
// ROTA: CANCELAR AGENDAMENTO (apenas admin)
// ============================================================
app.delete('/api/agendamentos/:id', autenticar, (req, res) => {
  const { id } = req.params;

  db.get(`SELECT estagiario_id FROM agendamentos WHERE id = ?`, [id], (err, ag) => {
    if (err) return res.status(500).json({ error: "Erro interno." });
    if (!ag) return res.status(404).json({ error: "Agendamento não encontrado." });
    // Estagiário só pode cancelar os próprios agendamentos
    if (req.usuario.perfil !== 'MEDICO' && ag.estagiario_id !== req.usuario.id)
      return res.status(403).json({ error: "Você não tem permissão para cancelar este agendamento." });

    db.run("UPDATE agendamentos SET status = 'CANCELADO' WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Agendamento cancelado com sucesso!" });
    });
  });
});
    


// ============================================================
// ROTA: MEUS LIMITES (contadores do estagiário logado)
// ============================================================
app.get('/api/meus-limites', autenticar, (req, res) => {
  const estagiario_id = req.usuario.id;

  // Conta total de pacientes do estagiário
  db.get(`SELECT COUNT(*) as totalPacientes FROM pacientes WHERE cadastrado_por_estagiario_id = ?`, [estagiario_id], (err, rowP) => {
    if (err) return res.status(500).json({ error: "Erro interno." });

    // Conta sessões agendadas por paciente (para mostrar quantas sessões restam)
    db.all(
      `SELECT paciente_id, COUNT(*) as sessoes FROM agendamentos WHERE estagiario_id = ? AND status IN ('AGENDADO' , 'CONCLUIDO') GROUP BY paciente_id`,
      [estagiario_id],
      (err, rowS) => {
        if (err) return res.status(500).json({ error: "Erro interno." });
        res.json({
          totalPacientes: rowP.totalPacientes,
          maxPacientes: MAX_PACIENTES_POR_ESTAGIARIO,
          sessoesPorPaciente: rowS,
          maxSessoes: MAX_SESSOES_POR_PACIENTE
        });
      }
    );
  });
});

// ============================================================
// ROTA: ESQUECI MINHA SENHA — Solicitar link de recuperação
// ============================================================
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail é obrigatório." });

  db.get("SELECT id FROM estagiarios WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (!user) return res.json({ message: "Se o e-mail existir, um link de recuperação foi enviado." });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiraEm = new Date(Date.now() + 3600000).toISOString();

    db.run(
      "INSERT INTO tokens_recuperacao (estagiario_id, token_hash, expira_em) VALUES (?, ?, ?)",
      [user.id, tokenHash, expiraEm],
      async (err) => {
        if (err) return res.status(500).json({ error: "Erro ao gerar token." });

        const link = `http://localhost:5173/reset-password?token=${token}`;

        try {
          await resend.emails.send({
            from: 'Sistema Psicologia <onboarding@resend.dev>',
            to: email,
            subject: 'Recuperação de Senha',
            html: `
              <h2>Recuperação de Senha</h2>
              <p>Clique no link abaixo para redefinir sua senha. O link expira em 1 hora.</p>
              <a href="${link}" style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">
                Redefinir Senha
              </a>
              <p style="color:#888;font-size:12px;margin-top:16px;">Se você não solicitou isso, ignore este e-mail.</p>
            `,
          });
          res.json({ message: "Se o e-mail existir, um link de recuperação foi enviado." });
        } catch (emailErr) {
          console.error("Erro ao enviar e-mail:", emailErr);
          res.status(500).json({ error: "Erro ao enviar e-mail de recuperação." });
        }
      }
    );
  });
});
// ============================================================
// ROTA: ESQUECI MINHA SENHA — Redefinir senha com token
// ============================================================
app.post('/api/reset-password', async (req, res) => {
  const { token, novaSenha } = req.body;
  if (!token || !novaSenha) return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
  if (novaSenha.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });

  // Recalcula o hash do token recebido para comparar com o banco
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  db.get(
    `SELECT estagiario_id FROM tokens_recuperacao WHERE token_hash = ? AND usado = 0 AND expira_em > datetime('now')`,
    [tokenHash],
    async (err, row) => {
      if (err) return res.status(500).json({ error: "Erro interno no servidor." });
      if (!row) return res.status(400).json({ error: "Token inválido ou expirado." });

      try {
        const novaSenhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
        db.serialize(() => {
          // Atualiza a senha do usuário
          db.run("UPDATE estagiarios SET senha = ? WHERE id = ?", [novaSenhaHash, row.estagiario_id]);
          // Marca o token como usado para impedir reutilização
          db.run("UPDATE tokens_recuperacao SET usado = 1 WHERE token_hash = ?", [tokenHash]);
        });
        res.json({ message: "Senha atualizada com sucesso!" });
      } catch {
        res.status(500).json({ error: "Erro ao processar nova senha." });
      }
    }
  );
});

// ============================================================
// JOB AGENDADO — finaliza sessões automaticamente após 50 minutos
// Roda a cada 1 minuto verificando sessões que passaram do tempo
// ============================================================
setInterval(() => {
  db.run(
    `UPDATE agendamentos 
     SET status = 'CONCLUIDO'
     WHERE sessao_iniciada = 1 
     AND status = 'AGENDADO'
     AND datetime(data_inicio_real, '+50 minutes') <= datetime('now')`,
    function (err) {
      if (err) {
        console.error("Erro ao finalizar sessões:", err.message);
      } else if (this.changes > 0) {
        console.log(`[JOB] ${this.changes} sessão(ões) finalizada(s) automaticamente.`);
      }
    }
  );
}, 60000); // 60000ms = 1 minuto

// ============================================================
// INICIA O SERVIDOR na porta 3001
// ============================================================
const PORT = process.env.PORT || 3001;
app.get('/api/reset-admin', async (req, res) => {
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.default.hash('123456', 10);
  db.run(`INSERT OR REPLACE INTO estagiarios (nome, ra, senha, perfil) VALUES ('Admin', 'admin', ?, 'MEDICO')`, [hash], (err) => {
    res.json(err ? { error: err.message } : { ok: true });
  });
});
app.get('/api/check-users', (req, res) => {
  db.all('SELECT id, nome, ra, perfil, senha FROM estagiarios', [], (err, rows) => {
    res.json(err ? { error: err.message } : rows);
  });
});
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// ============================================================
// ROTA: RELATÓRIO MENSAL (apenas admin)
// Retorna agendamentos agrupados por estagiário e paciente
// filtrados pelo mês informado (formato: YYYY-MM)
// ============================================================
app.get('/api/relatorio', autenticar, apenasAdmin, (req, res) => {
  const { mes } = req.query; // ex: 2024-05
  if (!mes) return res.status(400).json({ error: "Parâmetro 'mes' é obrigatório. Formato: YYYY-MM" });

  const sql = `
    SELECT
      e.id as estagiario_id,
      e.nome as estagiario_nome,
      p.id as paciente_id,
      p.nome_enc as paciente_nome,
      COUNT(*) as total_sessoes,
      SUM(a.sessao_iniciada) as sessoes_iniciadas,
      a.status
    FROM agendamentos a
    JOIN estagiarios e ON a.estagiario_id = e.id
    JOIN pacientes p ON a.paciente_id = p.id
    WHERE strftime('%Y-%m', a.data_inicio) = ?
    AND a.status IN  ('AGENDADO', 'CONCLUIDO')  -- Considera apenas sessões que foram agendadas ou concluídas
    GROUP BY e.id, p.id
    ORDER BY e.nome, p.nome_enc
  `;

  db.all(sql, [mes], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Agrupa os resultados por estagiário
    const agrupado = {};
    rows.forEach((row) => {
      if (!agrupado[row.estagiario_id]) {
        agrupado[row.estagiario_id] = {
          id: row.estagiario_id,
          nome: row.estagiario_nome,
          total_sessoes: 0,
          total_iniciadas: 0,
          pacientes: [],
        };
      }
      agrupado[row.estagiario_id].total_sessoes += row.total_sessoes;
      agrupado[row.estagiario_id].total_iniciadas += row.sessoes_iniciadas || 0;
      agrupado[row.estagiario_id].pacientes.push({
        id: row.paciente_id,
        nome: row.paciente_nome,
        total_sessoes: row.total_sessoes,
        sessoes_iniciadas: row.sessoes_iniciadas || 0,
      });
    });

    res.json({
      mes,
      estagiarios: Object.values(agrupado),
      total_geral: rows.reduce((acc, r) => acc + r.total_sessoes, 0),
    });
  });
});
