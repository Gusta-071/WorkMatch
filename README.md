WORKMATCH

Marketplace de freelancers que conecta clientes (contratantes) a prestadores de serviço, com negociação de orçamento, controle de ciclo de vida da demanda e sistema de reputação. Projeto desenvolvido para a disciplina de Programação Orientada a Objetos (POO).

Aplicação no ar: https://workmatch-test.vercel.app
API (backend): https://workmatch-9hvx.onrender.com

STACK

Backend — workmatch-backend/

TypeScript (Node.js, type: module)
Express 5
Prisma ORM 7 + adapter @prisma/adapter-libsql sobre SQLite/libSQL
bcryptjs (hash de senha), cors, dotenv
Execução via tsx

Frontend — workmatch-frontend/

React 19 + TypeScript
Vite 8
React Router DOM 7
Axios
oxlint (lint)

Infraestrutura (produção)

Turso (libSQL) — banco de dados SQLite distribuído na nuvem
Render — hospedagem do backend (Web Service)
Vercel — hospedagem do frontend (build estático)

ARQUITETURA

O backend segue uma separação clássica em camadas.

workmatch-backend/src/
  domain/          Entidades e regras de negócio (POO puro, sem dependência do Prisma)
    Usuario.ts
    Demanda.ts
    Orcamento.ts
    NivelExperiencia.ts
  repositories/    Padrão Repository: converte entre entidades de domínio e o banco (Prisma)
    UsuarioRepository.ts
    DemandaRepository.ts
    OrcamentoRepository.ts
    CategoriaRepository.ts
  database/
    prisma.ts
  server.ts        Endpoints da API

As classes de domínio (Usuario, Demanda, Orcamento) encapsulam seu estado com propriedades privadas e getters, expondo apenas métodos de negócio (ex: aprovarOrcamento, avaliarPrestador, contrapropor). Cada uma tem um factory method estático reconstituir(...) usado pelos repositórios para reidratar objetos vindos do banco sem repetir as validações do construtor.

O frontend usa um layout com sidebar e um SubpainelContext para injetar subpainéis contextuais por página (Explorar, Solicitações, Serviços, Perfil).

MODELO DE DADOS

Usuario — cliente e/ou prestador. Mantém reputação separada como cliente e como prestador (reputacaoCliente, reputacaoPrestador), competências (Competencia) e total de serviços concluídos.

Categoria / Habilidade — catálogo de categorias de serviço e habilidades vinculadas.

Demanda — solicitação de serviço criada por um contratante, com categoria, valor estimado, prazo, nível mínimo exigido e reputação mínima exigida.

Orcamento — proposta de valor de um prestador para uma demanda, com histórico de negociação.

REGRAS DE NEGÓCIO

Ciclo de vida da Demanda:

ABERTA -> NEGOCIACAO -> APROVADA -> CONCLUIDA
ABERTA/NEGOCIACAO -> DESABILITADA -> (reativar) -> ABERTA
ABERTA/DESABILITADA -> EXCLUIDA

Uma demanda só pode ser desabilitada ou excluída antes de ser aprovada.
Ao aprovar um orçamento, a demanda define o prestador escolhido e o valorFinalAcordado.
Após a entrega do prestador, cliente e prestador se avaliam mutuamente (nota de 0 a 5); a demanda só é marcada como CONCLUÍDA quando ambas as avaliações existem.
Avaliação automática: se uma das partes não avaliar em até 3 dias após a entrega do prestador, o sistema aplica nota máxima (5) automaticamente para destravar a conclusão.

Taxa por nível de experiência:

O valor estimado de uma demanda recebe uma taxa conforme o nível mínimo exigido definido pelo contratante (não o nível real do prestador que aceitar):

Nível ......... Taxa
Iniciante ...... 0%
Intermediário .. 5%
Avançado ....... 10%
Especialista ... 20%

O nível de experiência de um prestador é calculado automaticamente pelo total de serviços concluídos (Iniciante até 5, Intermediário até 15, Avançado até 30, Especialista acima disso).

Orçamento (negociação "ping-pong"):

Status possíveis: PENDENTE, ACEITO, RECUSADO, EXCLUIDO.
Uma contraproposta só pode ser feita pela parte que NÃO fez a última proposta (ultimaPropostaPor alterna entre PRESTADOR e CLIENTE), evitando que alguém sobrescreva a própria oferta.
Um orçamento recusado pode ser reaberto com um novo valor, voltando a PENDENTE.
Um orçamento só pode ser excluído definitivamente depois de recusado.

DEPLOY (PRODUÇÃO)

A aplicação está publicada e acessível publicamente:

Camada ........... Serviço ............ URL
Frontend .......... Vercel ............. https://workmatch-test.vercel.app
Backend ........... Render ............. https://workmatch-9hvx.onrender.com
Banco de dados .... Turso (libSQL) ..... —

Observação: o backend está no plano gratuito do Render, que hiberna após 15 minutos sem receber requisições. A primeira requisição depois de um período ocioso pode levar até ~1 minuto para responder enquanto o serviço "acorda"; as seguintes voltam ao normal. O banco (Turso) e o frontend (Vercel) não hibernam.

Variáveis de ambiente do backend (produção)

Configuradas diretamente no painel do Render (não versionadas no repositório):

TURSO_DATABASE_URL=<url do banco no Turso>
TURSO_AUTH_TOKEN=<token de autenticação do Turso>
FRONTEND_URL=https://workmatch-test.vercel.app

Variável de ambiente do frontend (produção)

Configurada no painel da Vercel:

VITE_API_URL=https://workmatch-9hvx.onrender.com

COMO RODAR LOCALMENTE

Backend:

cd workmatch-backend
npm install
npx prisma migrate dev     (cria/atualiza o banco SQLite local)
npm run start              (tsx src/server.ts)

Configure o .env com a string de conexão do SQLite local, por exemplo:

DATABASE_URL="file:./prisma/dev.db"

(As variáveis TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são opcionais em desenvolvimento — se não estiverem definidas, a aplicação usa o SQLite local via DATABASE_URL normalmente.)

Frontend:

cd workmatch-frontend
npm install
npm run dev       (essencial: sobe o ambiente de desenvolvimento Vite com hot-reload)

Outros scripts disponíveis, não essenciais para o uso diário:

npm run build — gera a versão de produção (tsc -b + build do Vite) em dist/, usado apenas se for hospedar/publicar o projeto.
npm run lint — roda o oxlint para checar más práticas e código morto no TS/React.

Obs: o projeto foi criado a partir do template padrão Vite + React + TS. Se quiser lint com verificação de tipos, é possível habilitar regras type-aware do oxlint instalando oxlint-tsgolint e ajustando .oxlintrc.json (ver documentação do Oxlint em oxc.rs).

ESTRUTURA DE PÁGINAS (FRONTEND)

Login — cadastro/login de usuários.
Explorar — busca/filtra demandas disponíveis no marketplace.
Solicitações — demandas e orçamentos em negociação.
Serviços — demandas aprovadas/concluídas, do ponto de vista de contratante ou prestador.
<<<<<<< HEAD
Perfil — dados do usuário, competências e reputação.
=======
Perfil — dados do usuário, competências e reputação.
>>>>>>> 7e81d693549b9a02bc6443fe868b68e89c64560f
