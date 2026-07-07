/**
 * Tela de Login/Cadastro.
 * Fluxo em etapas: informar ID → senha (login) ou cadastro (se o ID não
 * existir), com telas intermediárias de transição/redirecionamento
 * automático entre as etapas.
 */

import { useState, useEffect } from 'react';
import { api } from '../api';

type Etapa = 'id' | 'senha' | 'naoEncontrado' | 'cadastro' | 'sucesso' | 'loginSucesso';

// Tempo de exibição das telas de transição antes do redirecionamento automático.
const DURACAO_REDIRECT_MS = 5000;

// Calcula a força da senha digitada, retornando um percentual (0 a 1) e um rótulo/cor associados.
function avaliarForcaSenha(senha: string): { forca: number; label: string; cor: string } {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;

  const niveis = [
    { label: 'Muito fraca', cor: '#ef4444' },
    { label: 'Fraca', cor: '#f97316' },
    { label: 'Razoável', cor: '#eab308' },
    { label: 'Boa', cor: '#84cc16' },
    { label: 'Forte', cor: '#22c55e' },
    { label: 'Muito forte', cor: '#16a34a' },
  ];

  const indice = Math.min(pontos, niveis.length - 1);
  return { forca: senha.length === 0 ? 0 : (indice + 1) / niveis.length, ...niveis[indice] };
}

// Barra de progresso genérica, usada nas telas de transição/redirecionamento.
function BarraProgresso({ progresso }: { progresso: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: '8px',
        borderRadius: '4px',
        backgroundColor: '#e2e8f0',
        overflow: 'hidden',
        marginTop: '4px',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: '4px',
          backgroundColor: '#4f46e5',
          width: `${progresso * 100}%`,
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
}

export default function Login() {
  const [etapa, setEtapa] = useState<Etapa>('id');
  const [id, setId] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  // Controla o avanço automático (com barra de progresso) nas telas de transição.
  useEffect(() => {
    const telasComRedirect: Etapa[] = ['naoEncontrado', 'sucesso', 'loginSucesso'];
    if (!telasComRedirect.includes(etapa)) {
      setProgresso(0);
      return;
    }

    setProgresso(0);
    const inicio = Date.now();
    const interval = setInterval(() => {
      const decorrido = Date.now() - inicio;
      const pct = Math.min(decorrido / DURACAO_REDIRECT_MS, 1);
      setProgresso(pct);

      if (pct >= 1) {
        clearInterval(interval);
        if (etapa === 'naoEncontrado') setEtapa('cadastro');
        if (etapa === 'sucesso') resetParaLoginAposCadastro();
        if (etapa === 'loginSucesso') window.location.href = '/app';
      }
    }, 50);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa]);

  const forca = avaliarForcaSenha(novaSenha);

  // Verifica se o ID informado já possui cadastro, decidindo entre login ou cadastro.
  const checarId = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await api.get(`/usuarios/${id}/existe`);
      if (res.data.existe) {
        setEtapa('senha');
      } else {
        setEtapa('naoEncontrado');
      }
    } catch {
      setErro('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  // Autentica o usuário e persiste os dados de sessão no localStorage.
  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await api.post('/login', { id, senha });
      localStorage.setItem('@WorkMatch:user', JSON.stringify(res.data));
      setEtapa('loginSucesso');
    } catch (err: any) {
      setErro(err.response?.data?.error ?? 'Senha incorreta.');
    } finally {
      setCarregando(false);
    }
  };

  // Valida e envia os dados de um novo cadastro.
  const finalizarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (novaSenha.length < 8) {
      setErro('A senha precisa ter no mínimo 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    try {
      await api.post('/usuarios', { id, nome, email, senha: novaSenha });
      setEtapa('sucesso');
    } catch (err: any) {
      setErro(err.response?.data?.error ?? 'Não foi possível concluir o cadastro.');
    } finally {
      setCarregando(false);
    }
  };

  // Volta para a etapa de identificação por ID, limpando a senha digitada.
  const voltarParaId = () => {
    setEtapa('id');
    setSenha('');
    setErro(null);
  };

  // Limpa os campos de cadastro e retorna à etapa inicial de login.
  const resetParaLoginAposCadastro = () => {
    setNome('');
    setEmail('');
    setNovaSenha('');
    setConfirmarSenha('');
    setSenha('');
    setEtapa('id');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>WorkMatch</h1>
        <p style={styles.subtitulo}>
          {etapa === 'id' && 'Bem-vindo de volta. Informe seu ID para continuar.'}
          {etapa === 'senha' && 'Quase lá — confirme sua senha.'}
          {etapa === 'naoEncontrado' && 'Vamos criar sua conta.'}
          {etapa === 'cadastro' && 'Preencha seus dados para se cadastrar.'}
          {etapa === 'sucesso' && 'Tudo certo!'}
          {etapa === 'loginSucesso' && 'Login efetuado!'}
        </p>

        {etapa === 'id' && (
          <form onSubmit={checarId} style={styles.form}>
            <input
              placeholder="Seu ID"
              style={styles.input}
              value={id}
              onChange={e => setId(e.target.value)}
              autoFocus
              required
            />
            <button style={styles.botao} disabled={carregando}>
              {carregando ? 'Verificando...' : 'Continuar →'}
            </button>
            <p style={styles.linkCadastro}>
              Ainda não é cadastrado?{' '}
              <span style={styles.link} onClick={() => setEtapa('cadastro')}>
                Cadastre-se aqui
              </span>
            </p>
          </form>
        )}

        {etapa === 'senha' && (
          <form onSubmit={fazerLogin} style={styles.form}>
            <div style={styles.idChip}>
              <span>{id}</span>
              <button type="button" style={styles.trocarId} onClick={voltarParaId}>
                trocar
              </button>
            </div>
            <input
              type="password"
              placeholder="Sua senha"
              style={styles.input}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              autoFocus
              required
            />
            <button style={styles.botao} disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar →'}
            </button>
          </form>
        )}

        {etapa === 'naoEncontrado' && (
          <div style={styles.form}>
            <div style={styles.avisoNaoEncontrado}>
              Parece que você ainda não tem cadastro com esse ID. Vamos te redirecionar para criar sua conta...
            </div>
            <BarraProgresso progresso={progresso} />
            <div style={styles.botoesDuplos}>
              <button type="button" style={styles.botaoSecundario} onClick={voltarParaId}>
                Voltar
              </button>
              <button type="button" style={{ ...styles.botao, flex: 1 }} onClick={() => setEtapa('cadastro')}>
                Ir agora →
              </button>
            </div>
          </div>
        )}

        {etapa === 'sucesso' && (
          <div style={styles.form}>
            <div style={styles.avisoSucesso}>
              Conta criada com sucesso! Vamos te levar para o login...
            </div>
            <BarraProgresso progresso={progresso} />
            <button type="button" style={styles.botao} onClick={resetParaLoginAposCadastro}>
              Ir agora →
            </button>
          </div>
        )}

        {etapa === 'loginSucesso' && (
          <div style={styles.form}>
            <div style={styles.avisoSucesso}>
              Login efetuado com sucesso! Te levando para o painel...
            </div>
            <BarraProgresso progresso={progresso} />
          </div>
        )}

        {etapa === 'cadastro' && (
          <form onSubmit={finalizarCadastro} style={styles.form}>
            <input
              placeholder="Seu ID"
              style={styles.input}
              value={id}
              onChange={e => setId(e.target.value)}
              required
            />
            <input
              placeholder="Nome completo"
              style={styles.input}
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="E-mail"
              style={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Senha (mín. 8 caracteres)"
              style={styles.input}
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              required
            />

            {novaSenha.length > 0 && (
              <div style={styles.barraContainer}>
                <div style={styles.barraFundo}>
                  <div
                    style={{
                      ...styles.barraPreenchida,
                      width: `${forca.forca * 100}%`,
                      backgroundColor: forca.cor,
                    }}
                  />
                </div>
                <span style={{ ...styles.barraLabel, color: forca.cor }}>{forca.label}</span>
              </div>
            )}

            <input
              type="password"
              placeholder="Confirmar senha"
              style={styles.input}
              value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)}
              required
            />

            <button style={styles.botao} disabled={carregando}>
              {carregando ? 'Criando conta...' : 'Criar conta →'}
            </button>
            <p style={styles.linkCadastro}>
              Já tem uma conta?{' '}
              <span style={styles.link} onClick={voltarParaId}>
                Fazer login
              </span>
            </p>
          </form>
        )}

        {erro && <p style={styles.erro}>{erro}</p>}
      </div>
    </div>
  );
}

// Estilos inline dos elementos da tela de login/cadastro.
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    backgroundColor: '#fff',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '380px',
    textAlign: 'center',
  },
  logo: {
    color: '#4f46e5',
    marginBottom: '8px',
    fontSize: '32px',
    fontWeight: 800,
    letterSpacing: '-0.5px',
  },
  subtitulo: {
    color: '#64748b',
    fontSize: '14px',
    marginBottom: '24px',
    minHeight: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
  },
  botao: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'background-color 0.15s',
  },
  linkCadastro: {
    marginTop: '4px',
    fontSize: '13px',
    color: '#64748b',
  },
  botoesDuplos: {
    display: 'flex',
    gap: '10px',
  },
  botaoSecundario: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    color: '#334155',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
  },
  link: {
    color: '#4f46e5',
    cursor: 'pointer',
    fontWeight: 600,
  },
  erro: {
    marginTop: '16px',
    color: '#ef4444',
    fontSize: '13px',
  },
  idChip: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#334155',
  },
  trocarId: {
    background: 'none',
    border: 'none',
    color: '#4f46e5',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  avisoNaoEncontrado: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'left',
  },
  avisoSucesso: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'left',
  },
  barraContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '-4px',
  },
  barraFundo: {
    flex: 1,
    height: '6px',
    borderRadius: '4px',
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.2s ease, background-color 0.2s ease',
  },
  barraLabel: {
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
