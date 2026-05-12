import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;
const MAX_PACIENTES_POR_ESTAGIARIO = 3;
const MAX_SESSOES_POR_PACIENTE = 10;

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error("Erro ao abrir banco:", err.message);
  } else {
    console.log("Conectado ao SQLite V7.1 (WAL Mode On)");
    db.run("PRAGMA journal_mode = WAL;");
    db.run("PRAGMA foreign_keys = ON;");
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS estagiarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT,
        telefone TEXT,
        ra TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        perfil TEXT NOT NULL DEFAULT 'ESTAGIARIO',
        criado_por_id INTEGER
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_enc TEXT NOT NULL,
        cpf_hash TEXT,
        endereco TEXT,
        email TEXT,
        telefone TEXT,
        cadastrado_por_estagiario_id INTEGER,
        FOREIGN KEY (cadastrado_por_estagiario_id) REFERENCES estagiarios(id)
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        estagiario_id INTEGER NOT NULL,
        sala_id INTEGER,
        data_inicio TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'AGENDADO',
        ultimo_editor_id INTEGER,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY (estagiario_id) REFERENCES estagiarios(id)
      )`);
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_conflito_sala_horario
        ON agendamentos (sala_id, data_inicio) WHERE status = 'AGENDADO'`);
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_paciente_conflito_horario
        ON agendamentos (paciente_id, data_inicio) WHERE status = 'AGENDADO'`);
      db.run(`CREATE TABLE IF NOT EXISTS tokens_recuperacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estagiario_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expira_em TEXT NOT NULL,
        usado INTEGER NOT NULL DEFAULT 0,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (estagiario_id) REFERENCES estagiarios(id)
      )`);
    });
  }
});

// ================================
// MIDDLEWARE JWT
// ================================
function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Acesso negado. Faça login." });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Token inválido ou expirado. Faça login novamente." });
  }
}

function apenasAdmin(req, res, next) {
  if (req.usuario.perfil !== 'MEDICO') return res.status(403).json({ error: "Acesso restrito ao Médico Master." });
  next();
}

// ================================
// LOGIN
// ================================
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: "RA e senha são obrigatórios." });

  db.get(`SELECT id, nome, perfil, senha FROM estagiarios WHERE ra = ?`, [ra], async (err, user) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (!user) return res.status(401).json({ error: "RA ou senha inválidos." });

    try {
      const senhaCorreta = await bcrypt.compare(senha, user.senha);
      if (!senhaCorreta) return res.status(401).json({ error: "RA ou senha inválidos." });

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

// ================================
// CADASTRAR ESTAGIÁRIO (público)
// ================================
app.post('/api/estagiarios', async (req, res) => {
  const { nome, email, telefone, ra, senha, perfil, criado_por_id } = req.body;
  if (!nome || !ra || !senha) return res.status(400).json({ error: "Nome, RA e senha são obrigatórios." });
  if (senha.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });

  try {
    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    db.run(
      `INSERT INTO estagiarios (nome, email, telefone, ra, senha, perfil, criado_por_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, email, telefone, ra, senhaHash, perfil || 'ESTAGIARIO', criado_por_id || null],
      function (err) {
        if (err) {
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

// ================================
// LISTAR ESTAGIÁRIOS (admin)
// ================================
app.get('/api/estagiarios', autenticar, apenasAdmin, (req, res) => {
  db.all("SELECT id, nome, email, telefone, ra, perfil FROM estagiarios", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================================
// BUSCAR ESTAGIÁRIO POR ID
// ================================
app.get("/api/estagiarios/:id", autenticar, (req, res) => {
  const { id } = req.params;
  if (req.usuario.perfil !== 'MEDICO' && req.usuario.id !== parseInt(id))
    return res.status(403).json({ error: "Acesso negado." });

  db.get(`SELECT id, nome, email, telefone, ra, perfil FROM estagiarios WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(row);
  });
});

// ================================
// DELETAR ESTAGIÁRIO (admin)
// ================================
app.delete('/api/estagiarios/:id', autenticar, apenasAdmin, (req, res) => {
  const { id } = req.params;

  // Impede deletar o próprio admin
  if (parseInt(id) === req.usuario.id)
    return res.status(400).json({ error: "Você não pode deletar sua própria conta." });

  db.run("DELETE FROM estagiarios WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Estagiário não encontrado." });
    res.json({ message: "Estagiário deletado com sucesso!" });
  });
});

// ================================
// EDITAR ESTAGIÁRIO
// ================================
app.put('/api/estagiarios/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone } = req.body;
  if (req.usuario.perfil !== 'MEDICO' && req.usuario.id !== parseInt(id))
    return res.status(403).json({ error: "Acesso negado." });

  db.run(`UPDATE estagiarios SET nome = ?, email = ?, telefone = ? WHERE id = ?`, [nome, email, telefone, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ message: "Dados atualizados com sucesso!" });
  });
});

// ================================
// DELETAR ESTAGIÁRIO (admin)
// ================================
app.delete('/api/estagiarios/:id', autenticar, apenasAdmin, (req, res) => {
  const { id } = req.params;

  // Não permite deletar a si mesmo
  if (req.usuario.id === parseInt(id))
    return res.status(400).json({ error: "Você não pode deletar sua própria conta." });

  db.run(`DELETE FROM estagiarios WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Estagiário não encontrado." });
    res.json({ message: "Estagiário deletado com sucesso!" });
  });
});

// ================================
// LISTAR PACIENTES
// ================================
app.get('/api/pacientes', autenticar, (req, res) => {
  const isAdmin = req.usuario.perfil === 'MEDICO';
  const sql = isAdmin
    ? `SELECT id, nome_enc as nome, cpf_hash as cpf, endereco, email, telefone, cadastrado_por_estagiario_id as estagiario_id FROM pacientes ORDER BY nome_enc`
    : `SELECT id, nome_enc as nome, cpf_hash as cpf, endereco, email, telefone, cadastrado_por_estagiario_id as estagiario_id FROM pacientes WHERE cadastrado_por_estagiario_id = ? ORDER BY nome_enc`;
  const params = isAdmin ? [] : [req.usuario.id];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================================
// CADASTRAR PACIENTE
// ================================
app.post('/api/pacientes', autenticar, (req, res) => {
  const { nome, cpf, endereco, email, telefone } = req.body;
  const estagiario_id = req.usuario.id;
  if (!nome) return res.status(400).json({ error: "Nome do paciente é obrigatório." });

  db.get(`SELECT COUNT(*) as total FROM pacientes WHERE cadastrado_por_estagiario_id = ?`, [estagiario_id], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (row.total >= MAX_PACIENTES_POR_ESTAGIARIO)
      return res.status(400).json({ error: `Limite atingido. Máximo de ${MAX_PACIENTES_POR_ESTAGIARIO} pacientes por estagiário.` });

    db.run(
      `INSERT INTO pacientes (nome_enc, cpf_hash, endereco, email, telefone, cadastrado_por_estagiario_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, cpf, endereco, email, telefone, estagiario_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: "Paciente cadastrado com sucesso!" });
      }
    );
  });
});

// ================================
// EDITAR PACIENTE
// ================================
app.put('/api/pacientes/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const { nome, cpf, endereco, email, telefone } = req.body;

  db.get(`SELECT cadastrado_por_estagiario_id FROM pacientes WHERE id = ?`, [id], (err, paciente) => {
    if (err) return res.status(500).json({ error: "Erro interno." });
    if (!paciente) return res.status(404).json({ error: "Paciente não encontrado." });
    if (req.usuario.perfil !== 'MEDICO' && paciente.cadastrado_por_estagiario_id !== req.usuario.id)
      return res.status(403).json({ error: "Você não tem permissão para editar este paciente." });

    db.run(
      `UPDATE pacientes SET nome_enc = ?, cpf_hash = ?, endereco = ?, email = ?, telefone = ? WHERE id = ?`,
      [nome, cpf, endereco, email, telefone, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Paciente atualizado com sucesso!" });
      }
    );
  });
});

// ================================
// SALAS DISPONÍVEIS POR DATA/HORA
// ================================
app.get('/api/salas-disponiveis', autenticar, (req, res) => {
  const { data_inicio } = req.query;
  if (!data_inicio) return res.status(400).json({ error: "data_inicio é obrigatório." });

  db.all(
    `SELECT sala_id FROM agendamentos 
     WHERE data_inicio = ? AND status = 'AGENDADO'`,
    [data_inicio],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Erro interno no servidor." });
      console.log('[SALAS] Buscando:', data_inicio, '| Ocupadas:', rows);
      res.json({ salasOcupadas: rows.map(r => r.sala_id) });
    }
  );
});

// ================================
// CRIAR AGENDAMENTO
// ================================
app.post('/api/agendamentos', autenticar, (req, res) => {
  const { paciente_id, sala_id, data_inicio } = req.body;
  const estagiario_id = req.usuario.id;
  if (!paciente_id || !data_inicio || !sala_id)
    return res.status(400).json({ error: "Paciente, sala e data são obrigatórios." });

  db.get(`SELECT cadastrado_por_estagiario_id FROM pacientes WHERE id = ?`, [paciente_id], (err, paciente) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (!paciente) return res.status(404).json({ error: "Paciente não encontrado." });
    if (req.usuario.perfil !== 'MEDICO' && paciente.cadastrado_por_estagiario_id !== estagiario_id)
      return res.status(403).json({ error: "Este paciente não pertence a você." });

    db.get(
      `SELECT COUNT(*) as total FROM agendamentos WHERE paciente_id = ? AND estagiario_id = ? AND status = 'AGENDADO'`,
      [paciente_id, estagiario_id],
      (err, row) => {
        if (err) return res.status(500).json({ error: "Erro interno no servidor." });
        if (row.total >= MAX_SESSOES_POR_PACIENTE)
          return res.status(400).json({ error: `Limite atingido. Máximo de ${MAX_SESSOES_POR_PACIENTE} sessões por paciente.` });

        const dataApenas = data_inicio.split(' ')[0];
        db.get(
          `SELECT id FROM agendamentos WHERE paciente_id = ? AND date(data_inicio) = date(?) AND status = 'AGENDADO'`,
          [paciente_id, dataApenas],
          (err, conflitoDia) => {
            if (err) return res.status(500).json({ error: "Erro interno no servidor." });
            if (conflitoDia) return res.status(400).json({ error: "Paciente já possui agendamento para este dia." });

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

// ================================
// LISTAR AGENDAMENTOS
// ================================
app.get('/api/agendamentos', autenticar, (req, res) => {
  const isAdmin = req.usuario.perfil === 'MEDICO';
  const sql = isAdmin
    ? `SELECT a.id, a.data_inicio, a.sala_id, a.paciente_id, a.estagiario_id, a.status,
             p.nome_enc as nomePaciente, e.nome as nomeEstagiario
       FROM agendamentos a
       JOIN pacientes p ON a.paciente_id = p.id
       JOIN estagiarios e ON a.estagiario_id = e.id
       ORDER BY a.data_inicio DESC`
    : `SELECT a.id, a.data_inicio, a.sala_id, a.paciente_id, a.estagiario_id, a.status,
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


// ================================
// EDITAR AGENDAMENTO
// ================================
app.put('/api/agendamentos/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const { sala_id, data_inicio } = req.body;

  db.get(`SELECT estagiario_id, paciente_id FROM agendamentos WHERE id = ?`, [id], (err, ag) => {
    if (err) return res.status(500).json({ error: "Erro interno." });
    if (!ag) return res.status(404).json({ error: "Agendamento não encontrado." });
    if (req.usuario.perfil !== 'MEDICO' && ag.estagiario_id !== req.usuario.id)
      return res.status(403).json({ error: "Você não tem permissão para editar este agendamento." });

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

// ================================
// CANCELAR AGENDAMENTO (apenas admin)
// ================================
app.delete('/api/agendamentos/:id', autenticar, apenasAdmin, (req, res) => {
  const { id } = req.params;

  db.get(`SELECT id FROM agendamentos WHERE id = ?`, [id], (err, ag) => {
    if (err) return res.status(500).json({ error: "Erro interno." });
    if (!ag) return res.status(404).json({ error: "Agendamento não encontrado." });

    db.run("UPDATE agendamentos SET status = 'CANCELADO' WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Agendamento cancelado com sucesso!" });
    });
  });
});

// ================================
// MEUS LIMITES (contadores do estagiário)
// ================================
app.get('/api/meus-limites', autenticar, (req, res) => {
  const estagiario_id = req.usuario.id;

  db.get(`SELECT COUNT(*) as totalPacientes FROM pacientes WHERE cadastrado_por_estagiario_id = ?`, [estagiario_id], (err, rowP) => {
    if (err) return res.status(500).json({ error: "Erro interno." });

    db.all(
      `SELECT paciente_id, COUNT(*) as sessoes FROM agendamentos WHERE estagiario_id = ? AND status = 'AGENDADO' GROUP BY paciente_id`,
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

// ================================
// ESQUECI MINHA SENHA — Solicitar
// ================================
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail é obrigatório." });

  db.get("SELECT id FROM estagiarios WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: "Erro interno no servidor." });
    if (!user) return res.json({ message: "Se o e-mail existir, um link de recuperação foi enviado." });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiraEm = new Date(Date.now() + 3600000).toISOString();

    db.run(
      "INSERT INTO tokens_recuperacao (estagiario_id, token_hash, expira_em) VALUES (?, ?, ?)",
      [user.id, tokenHash, expiraEm],
      (err) => {
        if (err) return res.status(500).json({ error: "Erro ao gerar token." });
        console.log(`[RECUPERAÇÃO] http://localhost:5173/reset-password?token=${token}`);
        res.json({ message: "Se o e-mail existir, um link de recuperação foi enviado." });
      }
    );
  });
});

// ================================
// ESQUECI MINHA SENHA — Redefinir
// ================================
app.post('/api/reset-password', async (req, res) => {
  const { token, novaSenha } = req.body;
  if (!token || !novaSenha) return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
  if (novaSenha.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });

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
          db.run("UPDATE estagiarios SET senha = ? WHERE id = ?", [novaSenhaHash, row.estagiario_id]);
          db.run("UPDATE tokens_recuperacao SET usado = 1 WHERE token_hash = ?", [tokenHash]);
        });
        res.json({ message: "Senha atualizada com sucesso!" });
      } catch {
        res.status(500).json({ error: "Erro ao processar nova senha." });
      }
    }
  );
});

// ================================
// SERVIDOR
// ================================
app.listen(3001, () => {
  console.log("Servidor rodando na porta 3001");
});
