/**
 * Servidor HTTP (Express) da aplicação WorkMatch.
 * Expõe a API REST para autenticação, perfil de usuário, categorias,
 * demandas, orçamentos e o fluxo de entrega/avaliação de serviços.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';

import { UsuarioRepository } from './repositories/UsuarioRepository';
import { CategoriaRepository } from './repositories/CategoriaRepository';
import { DemandaRepository } from './repositories/DemandaRepository';
import { OrcamentoRepository } from './repositories/OrcamentoRepository';
import { Demanda } from './domain/Demanda';
import { Orcamento, AutorProposta } from './domain/Orcamento';
import { NivelExperiencia } from './domain/NivelExperiencia';
import { Usuario } from './domain/Usuario';

const app = express();
app.use(express.json());

// Em produção, libera CORS só para o domínio do frontend (FRONTEND_URL).
// Em desenvolvimento (sem a env var), libera geral para facilitar o localhost.
const origensPermitidas = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
  : true;

app.use(cors({ origin: origensPermitidas }));

const usuarioRepo = new UsuarioRepository();
const categoriaRepo = new CategoriaRepository();
const demandaRepo = new DemandaRepository();
const orcamentoRepo = new OrcamentoRepository();

/**
 * Centraliza o tratamento de erros de negócio lançados pelas entidades do domínio.
 * Retorna o status HTTP 400 com a mensagem de falha da regra de validação original.
 */
function erroDominio(res: any, e: any) {
  return res.status(400).json({ error: e.message ?? 'Erro ao processar a solicitação.' });
}

// ─── STATUS ────────────────────────────────────────────────────────────────

// Verifica se o servidor está no ar.
app.get('/status', (_req, res) => {
  res.json({ status: 'Online' });
});

// ─── AUTENTICAÇÃO ──────────────────────────────────────────────────────────

// Verifica se um ID de usuário já está cadastrado.
app.get('/usuarios/:id/existe', async (req: any, res: any) => {
  try {
    const usuario = await usuarioRepo.buscarPorId(req.params.id);
    return res.json({ existe: !!usuario, nome: usuario?.nome ?? null });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Autentica um usuário validando o ID e a senha.
app.post('/login', async (req: any, res: any) => {
  try {
    const { id, senha } = req.body;
    const usuario = await usuarioRepo.buscarPorId(id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    return res.json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Cadastra um novo usuário, validando senha, ID e e-mail únicos.
app.post('/usuarios', async (req: any, res: any) => {
  try {
    const { id, nome, email, senha } = req.body;

    if (!senha || senha.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres.' });
    }

    if (await usuarioRepo.buscarPorId(id)) {
      return res.status(409).json({ error: 'Esse ID já está em uso.' });
    }

    if (await usuarioRepo.buscarPorEmail(email)) {
      return res.status(409).json({ error: 'Esse e-mail já está em uso.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = new Usuario(id, nome, email, senhaHash);
    await usuarioRepo.salvar(usuario);

    return res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// ─── USUÁRIOS E PERFIL ─────────────────────────────────────────────────────

// Retorna os dados públicos de perfil de um usuário.
app.get('/usuarios/:id', async (req: any, res: any) => {
  try {
    const usuario = await usuarioRepo.buscarPorId(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    return res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      reputacaoPrestador: usuario.reputacaoPrestador,
      reputacaoCliente: usuario.reputacaoCliente,
      totalServicosConcluidos: usuario.totalServicosConcluidos,
      nivelExperiencia: usuario.getNivelExperiencia(),
      competencias: [...usuario.competencias],
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Atualiza nome, e-mail e/ou senha do usuário, exigindo confirmação da senha atual.
app.patch('/usuarios/:id/perfil', async (req: any, res: any) => {
  try {
    const { nome, email, senhaAtual, novaSenha } = req.body;
    const usuario = await usuarioRepo.buscarPorId(req.params.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!senhaAtual || !(await bcrypt.compare(senhaAtual, usuario.senha))) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    if (email && email !== usuario.email) {
      const existente = await usuarioRepo.buscarPorEmail(email);
      if (existente && existente.id !== usuario.id) {
        return res.status(409).json({ error: 'Esse e-mail já está em uso.' });
      }
      usuario.email = email;
    }

    if (nome) {
      usuario.nome = nome;
    }

    if (novaSenha) {
      if (novaSenha.length < 8) {
        return res.status(400).json({ error: 'A nova senha precisa ter no mínimo 8 caracteres.' });
      }
      usuario.senha = await bcrypt.hash(novaSenha, 10);
    }

    await usuarioRepo.atualizar(usuario);
    return res.json({ id: usuario.id, nome: usuario.nome, email: usuario.email, message: 'Perfil atualizado com sucesso!' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Adiciona uma competência ao perfil do usuário.
app.post('/usuarios/:id/competencias', async (req: any, res: any) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome da competência é obrigatório.' });

    const usuario = await usuarioRepo.buscarPorId(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    usuario.adicionarHabilidade(nome);
    await usuarioRepo.atualizar(usuario);

    return res.json({ message: 'Competência adicionada.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Remove uma competência do perfil do usuário.
app.delete('/usuarios/:id/competencias/:nome', async (req: any, res: any) => {
  try {
    const usuario = await usuarioRepo.buscarPorId(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    usuario.removerHabilidade(req.params.nome);
    await usuarioRepo.atualizar(usuario);

    return res.json({ message: 'Competência removida.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// ─── CATEGORIAS ────────────────────────────────────────────────────────────

// Lista todas as categorias com suas habilidades.
app.get('/categorias', async (_req: any, res: any) => {
  try {
    const categories = await categoriaRepo.listarTodasComHabilidades();
    return res.json(categories);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── DEMANDAS ──────────────────────────────────────────────────────────────

// Lista demandas abertas no mercado para o usuário explorar.
app.get('/demandas/explorar/:usuarioId', async (req: any, res: any) => {
  try {
    const demandas = await demandaRepo.listarAbertasParaExplorar(req.params.usuarioId);
    return res.json(demandas);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Lista as demandas criadas pelo usuário como contratante.
app.get('/demandas/solicitacoes/:usuarioId', async (req: any, res: any) => {
  try {
    const demandas = await demandaRepo.listarPorContratante(req.params.usuarioId);
    return res.json(demandas);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Lista os serviços em andamento/concluídos do usuário como prestador.
app.get('/demandas/servicos/:usuarioId', async (req: any, res: any) => {
  try {
    const demandas = await demandaRepo.listarServicos(req.params.usuarioId);
    return res.json(demandas);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Retorna as habilidades mais requisitadas entre as demandas ativas.
// Aceita limite customizado via query param (?limit=N), padrão 8.
app.get('/demandas/habilidades-populares', async (req: any, res: any) => {
  try {
    const limite = req.query.limit ? Number(req.query.limit) : 8;
    const habilidades = await demandaRepo.getHabilidadesMaisBuscadas(limite);
    return res.json(habilidades);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Cria uma nova demanda para o contratante informado.
app.post('/demandas', async (req: any, res: any) => {
  try {
    const {
      id, contratanteId, titulo, descricao, valorEstimado,
      categoriaId, habilidadesExtras = [], prazoFinalizacao,
      nivelMinimoExigido = 'INICIANTE', reputacaoMinimaExigida = 0,
    } = req.body;

    const contratante = await usuarioRepo.buscarPorId(contratanteId);
    if (!contratante) return res.status(404).json({ error: 'Contratante não encontrado.' });

    const catId = Number(categoriaId);
    if (!(await categoriaRepo.buscarPorId(catId))) {
      return res.status(400).json({ error: `Categoria ${catId} não encontrada no banco de dados.` });
    }

    // valorEstimado é opcional: '', undefined ou null significam "a combinar".
    const valorEstimadoFinal = valorEstimado === '' || valorEstimado === undefined || valorEstimado === null
      ? null
      : Number(valorEstimado);

    const demanda = new Demanda(
      id,
      contratante,
      titulo,
      descricao,
      valorEstimadoFinal,
      catId,
      habilidadesExtras,
      new Date(prazoFinalizacao),
      nivelMinimoExigido as NivelExperiencia,
      Number(reputacaoMinimaExigida),
    );

    await demandaRepo.salvar(demanda);
    return res.status(201).json({ id: demanda.id, message: 'Demanda criada.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Cancela (desabilita) uma demanda e recusa os orçamentos pendentes vinculados a ela.
app.post('/demandas/:id/cancelar', async (req: any, res: any) => {
  try {
    const demanda = await demandaRepo.buscarPorId(req.params.id);
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada.' });

    demanda.desabilitar();
    await demandaRepo.atualizar(demanda);
    await orcamentoRepo.recusarTodosPendentesPorCancelamento(demanda.id);

    return res.json({ message: 'Demanda cancelada.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Reativa uma demanda previamente cancelada.
app.post('/demandas/:id/reativar', async (req: any, res: any) => {
  try {
    const demanda = await demandaRepo.buscarPorId(req.params.id);
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada.' });

    demanda.reativar();
    await demandaRepo.atualizar(demanda);

    return res.json({ message: 'Demanda reativada.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Exclui definitivamente uma demanda.
app.post('/demandas/:id/excluir', async (req: any, res: any) => {
  try {
    const demanda = await demandaRepo.buscarPorId(req.params.id);
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada.' });

    demanda.excluir();
    await demandaRepo.atualizar(demanda);

    return res.json({ message: 'Demanda excluída com sucesso.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// ─── ORÇAMENTOS ────────────────────────────────────────────────────────────

// Lista os orçamentos recebidos por uma demanda.
app.get('/demandas/:id/orcamentos', async (req: any, res: any) => {
  try {
    const orcamentos = await orcamentoRepo.listarPorDemanda(req.params.id);
    return res.json(orcamentos);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Lista os orçamentos enviados por um prestador.
app.get('/orcamentos/prestador/:prestadorId', async (req: any, res: any) => {
  try {
    const orcamentos = await orcamentoRepo.listarPorPrestador(req.params.prestadorId);
    return res.json(orcamentos);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Envia um novo orçamento para uma demanda, ou reabre um orçamento
// previamente recusado do mesmo prestador.
app.post('/demandas/:id/orcamentos', async (req: any, res: any) => {
  try {
    const { id: orcamentoId, prestadorId, valorProposto, mensagem } = req.body;

    const demanda = await demandaRepo.buscarPorId(req.params.id);
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada.' });

    const prestador = await usuarioRepo.buscarPorId(prestadorId);
    if (!prestador) return res.status(404).json({ error: 'Prestador não encontrado.' });

    if (demanda.contratante.id === prestadorId) {
      return res.status(400).json({ error: 'Não é permitido orçar a própria demanda.' });
    }

    let orcamento = await orcamentoRepo.buscarPorDemandaEPrestador(demanda.id, prestador.id);

    if (orcamento) {
      orcamento.reabrirAposRecusa(Number(valorProposto), mensagem || null);
      await orcamentoRepo.atualizar(orcamento);
    } else {
      orcamento = new Orcamento(orcamentoId, demanda, prestador, Number(valorProposto), mensagem || null);
      await orcamentoRepo.salvar(orcamento);
    }

    demanda.entrarEmNegociacao();
    await demandaRepo.atualizar(demanda);

    return res.status(201).json({ id: orcamento.id, message: 'Orçamento enviado.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Aceita um orçamento, aprova a demanda com o prestador escolhido e recusa
// automaticamente os demais orçamentos pendentes.
app.post('/orcamentos/:id/aceitar', async (req: any, res: any) => {
  try {
    const orcamento = await orcamentoRepo.buscarPorId(req.params.id);
    if (!orcamento) return res.status(404).json({ error: 'Orçamento não encontrado.' });

    orcamento.aceitar();
    orcamento.demanda.aprovarOrcamento(orcamento.prestador, orcamento.valorProposto);

    await orcamentoRepo.atualizar(orcamento);
    await demandaRepo.atualizar(orcamento.demanda);
    await orcamentoRepo.recusarTodosOutrosPendentes(orcamento.demanda.id, orcamento.id);

    return res.json({ message: 'Orçamento aceito.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Recusa um orçamento pendente.
app.post('/orcamentos/:id/recusar', async (req: any, res: any) => {
  try {
    const { mensagem } = req.body;
    const orcamento = await orcamentoRepo.buscarPorId(req.params.id);
    if (!orcamento) return res.status(404).json({ error: 'Orçamento não encontrado.' });

    orcamento.recusar(mensagem || null);
    await orcamentoRepo.atualizar(orcamento);

    return res.json({ message: 'Orçamento recusado.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Registra uma contraproposta de valor para um orçamento pendente.
app.patch('/orcamentos/:id/contrapropor', async (req: any, res: any) => {
  try {
    const { autor, novoValor, mensagem } = req.body;
    const orcamento = await orcamentoRepo.buscarPorId(req.params.id);
    if (!orcamento) return res.status(404).json({ error: 'Orçamento não encontrado.' });

    orcamento.contrapropor(Number(novoValor), mensagem || null, autor as AutorProposta);
    await orcamentoRepo.atualizar(orcamento);

    return res.json({ message: 'Contraproposta enviada.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// ─── SERVIÇOS (ENTREGA E AVALIAÇÃO) ────────────────────────────────────────

// Marca o serviço como entregue pelo prestador e, opcionalmente, já
// registra a avaliação do prestador para o cliente.
app.post('/demandas/:id/concluir', async (req: any, res: any) => {
  try {
    const { prestadorId, notaParaCliente } = req.body;
    const demanda = await demandaRepo.buscarPorId(req.params.id);
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada.' });

    if (demanda.prestadorEscolhido?.id !== prestadorId) {
      return res.status(403).json({ error: 'Apenas o prestador vinculado pode concluir esta demanda.' });
    }

    demanda.prestadorEntregarServico();

    if (notaParaCliente !== undefined) {
      demanda.avaliarCliente(Number(notaParaCliente));
    }

    await demandaRepo.atualizar(demanda);

    if (notaParaCliente !== undefined) {
      await usuarioRepo.atualizar(demanda.contratante);
    }

    return res.json({ message: 'Serviço marcado como concluído.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Registra a avaliação do prestador sobre o cliente.
app.post('/demandas/:id/avaliar-cliente', async (req: any, res: any) => {
  try {
    const { prestadorId, nota } = req.body;
    const demanda = await demandaRepo.buscarPorId(req.params.id);
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada.' });

    if (demanda.prestadorEscolhido?.id !== prestadorId) {
      return res.status(403).json({ error: 'Apenas o prestador desta demanda pode avaliar o cliente.' });
    }

    demanda.avaliarCliente(Number(nota));
    await demandaRepo.atualizar(demanda);
    await usuarioRepo.atualizar(demanda.contratante);

    return res.json({ message: 'Cliente avaliado.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// Registra a avaliação do cliente sobre o prestador.
app.post('/demandas/:id/avaliar-prestador', async (req: any, res: any) => {
  try {
    const { contratanteId, nota } = req.body;
    const demanda = await demandaRepo.buscarPorId(req.params.id);
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada.' });

    if (demanda.contratante.id !== contratanteId) {
      return res.status(403).json({ error: 'Apenas o contratante desta demanda pode avaliar o prestador.' });
    }

    demanda.avaliarPrestador(Number(nota));
    await demandaRepo.atualizar(demanda);

    if (demanda.prestadorEscolhido) {
      await usuarioRepo.atualizar(demanda.prestadorEscolhido);
    }

    return res.json({ message: 'Prestador avaliado.' });
  } catch (e: any) {
    return erroDominio(res, e);
  }
});

// ─── SEED DE DADOS ─────────────────────────────────────────────────────────

// Popula o banco com categorias e habilidades padrão (uso em desenvolvimento).
app.post('/seed/categorias', async (_req: any, res: any) => {
  try {
    const { prisma } = await import('./database/prisma');
    const categorias = [
      { nome: 'Tecnologia', habilidades: ['React', 'Node.js', 'TypeScript', 'Python', 'Docker', 'AWS', 'SQL', 'Git'] },
      { nome: 'Design', habilidades: ['Figma', 'UI/UX', 'Illustrator', 'Photoshop', 'Branding'] },
      { nome: 'Marketing', habilidades: ['SEO', 'Google Ads', 'Copywriting', 'Social Media', 'Analytics'] },
      { nome: 'Construção Civil', habilidades: ['Marcenaria', 'Elétrica', 'Hidráulica', 'Pintura', 'Alvenaria'] },
      { nome: 'Educação', habilidades: ['Matemática', 'Português', 'Inglês', 'Música', 'Física'] },
      { nome: 'Saúde & Bem-estar', habilidades: ['Nutrição', 'Personal Trainer', 'Yoga', 'Fisioterapia'] },
    ];

    for (const cat of categorias) {
      const criada = await prisma.categoria.upsert({
        where: { nome: cat.nome },
        update: {},
        create: { nome: cat.nome },
      });
      for (const h of cat.habilidades) {
        const existe = await prisma.habilidade.findFirst({ where: { categoriaId: criada.id, nome: h } });
        if (!existe) {
          await prisma.habilidade.create({ data: { categoriaId: criada.id, nome: h } });
        }
      }
    }

    return res.json({ message: 'Categorias e habilidades populadas.' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── INICIALIZAÇÃO ─────────────────────────────────────────────────────────

// Hosts como Render/Railway definem a porta via env var PORT.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});