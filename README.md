WORKMATCH

Marketplace de freelancers que conecta clientes (contratantes) a prestadores de servico, com negociacao de orcamento, controle de ciclo de vida da demanda e sistema de reputacao. Projeto desenvolvido para a disciplina de Programacao Orientada a Objetos (POO).


STACK

Backend - workmatch-backend/
- TypeScript (Node.js, type: module)
- Express 5
- Prisma ORM 7 + adapter @prisma/adapter-libsql sobre SQLite
- bcryptjs (hash de senha), cors, dotenv
- Execucao via tsx

Frontend - workmatch-frontend/
- React 19 + TypeScript
- Vite 8
- React Router DOM 7
- Axios
- oxlint (lint)


ARQUITETURA

O backend segue uma separacao classica em camadas:

workmatch-backend/src/
  domain/          Entidades e regras de negocio (POO puro, sem dependencia do Prisma)
    Usuario.ts
    Demanda.ts
    Orcamento.ts
    NivelExperiencia.ts
  repositories/    Padrao Repository: converte entre entidades de dominio e o banco (Prisma)
    UsuarioRepository.ts
    DemandaRepository.ts
    OrcamentoRepository.ts
    CategoriaRepository.ts
  database/
    prisma.ts
  server.ts        Endpoints da API

As classes de dominio (Usuario, Demanda, Orcamento) encapsulam seu estado com propriedades privadas e getters, expondo apenas metodos de negocio (ex: aprovarOrcamento, avaliarPrestador, contrapropor). Cada uma tem um factory method estatico reconstituir(...) usado pelos repositorios para reidratar objetos vindos do banco sem repetir as validacoes do construtor.

O frontend usa um layout com sidebar e um SubpainelContext para injetar subpaineis contextuais por pagina (Explorar, Solicitacoes, Servicos, Perfil).


MODELO DE DADOS

Usuario - cliente e/ou prestador. Mantem reputacao separada como cliente e como prestador (reputacaoCliente, reputacaoPrestador), competencias (Competencia) e total de servicos concluidos.

Categoria / Habilidade - catalogo de categorias de servico e habilidades vinculadas.

Demanda - solicitacao de servico criada por um contratante, com categoria, valor estimado, prazo, nivel minimo exigido e reputacao minima exigida.

Orcamento - proposta de valor de um prestador para uma demanda, com historico de negociacao.


REGRAS DE NEGOCIO

Ciclo de vida da Demanda:

ABERTA -> NEGOCIACAO -> APROVADA -> CONCLUIDA
ABERTA/NEGOCIACAO -> DESABILITADA -> (reativar) -> ABERTA
ABERTA/DESABILITADA -> EXCLUIDA

- Uma demanda so pode ser desabilitada ou excluida antes de ser aprovada.
- Ao aprovar um orcamento, a demanda define o prestador escolhido e o valorFinalAcordado.
- Apos a entrega do prestador, cliente e prestador se avaliam mutuamente (nota de 0 a 5); a demanda so e marcada como CONCLUIDA quando ambas as avaliacoes existem.
- Avaliacao automatica: se uma das partes nao avaliar em ate 3 dias apos a entrega do prestador, o sistema aplica nota maxima (5) automaticamente para destravar a conclusao.

Taxa por nivel de experiencia:

O valor estimado de uma demanda recebe uma taxa conforme o nivel minimo exigido definido pelo contratante (nao o nivel real do prestador que aceitar):

  Iniciante      0%
  Intermediario  5%
  Avancado       10%
  Especialista   20%

O nivel de experiencia de um prestador e calculado automaticamente pelo total de servicos concluidos (Iniciante ate 5, Intermediario ate 15, Avancado ate 30, Especialista acima disso).

Orcamento (negociacao "ping-pong"):

- Status possiveis: PENDENTE, ACEITO, RECUSADO, EXCLUIDO.
- Uma contraproposta so pode ser feita pela parte que NAO fez a ultima proposta (ultimaPropostaPor alterna entre PRESTADOR e CLIENTE), evitando que alguem sobrescreva a propria oferta.
- Um orcamento recusado pode ser reaberto com um novo valor, voltando a PENDENTE.
- Um orcamento so pode ser excluido definitivamente depois de recusado.


COMO RODAR

Backend:

  cd workmatch-backend
  npm install
  npx prisma migrate dev     (cria/atualiza o banco SQLite)
  npm run start              (tsx src/server.ts)

Configure o .env com a string de conexao do SQLite, por exemplo:

  DATABASE_URL="file:./prisma/dev.db"

Frontend:

  cd workmatch-frontend
  npm install
  npm run dev       (essencial: sobe o ambiente de desenvolvimento Vite com hot-reload)

Outros scripts disponiveis, nao essenciais para o uso diario:
- npm run build - gera a versao de producao (tsc -b + build do Vite) em dist/, usado apenas se for hospedar/publicar o projeto.
- npm run lint - roda o oxlint para checar mas praticas e codigo morto no TS/React.

Obs: o projeto foi criado a partir do template padrao Vite + React + TS. Se quiser lint com verificacao de tipos, e possivel habilitar regras type-aware do oxlint instalando oxlint-tsgolint e ajustando .oxlintrc.json (ver documentacao do Oxlint em oxc.rs).


ESTRUTURA DE PAGINAS (FRONTEND)

- Login - cadastro/login de usuarios.
- Explorar - busca/filtra demandas disponiveis no marketplace.
- Solicitacoes - demandas e orcamentos em negociacao.
- Servicos - demandas aprovadas/concluidas, do ponto de vista de contratante ou prestador.
- Perfil - dados do usuario, competencias e reputacao.