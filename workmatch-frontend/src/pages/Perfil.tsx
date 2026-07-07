/**
 * Aba "Perfil".
 * Exibe os dados do usuário (reputação, nível, competências), permite
 * editar informações cadastrais/senha e gerenciar habilidades, além de
 * mostrar as habilidades mais buscadas no mercado como tendência.
 */

import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import type { Usuario, Categoria } from '../types';
import { LABEL_NIVEL } from '../types';

interface PerfilProps {
  usuarioId?: string;
}

// Exibe uma nota de 0 a 5 como estrelas preenchidas/vazias.
function Estrela({ nota }: { nota: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: '#8b5cf6', fontSize: '16px' }}>
        {'★'.repeat(Math.round(nota))}
        {'☆'.repeat(5 - Math.round(nota))}
      </span>
      <span style={{ color: 'var(--text)', fontSize: '13px' }}>({nota.toFixed(1)})</span>
    </span>
  );
}

// Normaliza um texto (minúsculas, sem acentos, sem espaços nas pontas)
// para permitir comparações e buscas tolerantes a acentuação/caixa.
function removerAcentosETermo(texto: unknown): string {
  if (!texto) return '';
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function Perfil({ usuarioId }: PerfilProps) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [itemComHover, setItemComHover] = useState<string | null>(null);

  // Habilidades mais buscadas, vindas da agregação real de demandas ativas.
  const [habilidadesMaisBuscadas, setHabilidadesMaisBuscadas] = useState<string[]>([]);
  // Indica se os dados exibidos são reais (API) ou apenas um fallback local.
  const [tendenciasSaoFallback, setTendenciasSaoFallback] = useState(false);

  // Formulário de edição de perfil.
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Cadastro de habilidades e autocomplete.
  const [novaHabilidade, setNovaHabilidade] = useState('');
  const [enviandoHabilidade, setEnviandoHabilidade] = useState(false);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    inicializar();
  }, [usuarioId]);

  // Carrega em paralelo o perfil, as categorias e as tendências de mercado.
  const inicializar = async () => {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      await Promise.all([
        carregar(), 
        carregarCategorias(),
        buscarHabilidadesMaisBuscadas()
      ]);
    } catch (err) {
      setErroCarregamento('Não foi possível carregar os dados do perfil.');
    } finally {
      setCarregando(false);
    }
  };

  // Busca os dados do usuário e popula o formulário de edição.
  const carregar = async () => {
    const res = await api.get(`/usuarios/${usuarioId}`);
    setUsuario(res.data);
    setNome(res.data.nome);
    setEmail(res.data.email);
  };

  // Busca o catálogo de categorias/habilidades do sistema.
  const carregarCategorias = async () => {
    const res = await api.get('/categorias');
    if (res.data && Array.isArray(res.data)) {
      setCategorias(res.data);
    }
  };

  // Busca as habilidades mais recorrentes nas demandas ativas do mercado.
  // Se não houver dados reais (banco vazio ou erro), marca como fallback.
  const buscarHabilidadesMaisBuscadas = async () => {
    try {
      const res = await api.get('/demandas/habilidades-populares');

      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setHabilidadesMaisBuscadas(res.data);
        setTendenciasSaoFallback(false);
      } else {
        setHabilidadesMaisBuscadas([]);
        setTendenciasSaoFallback(true);
      }
    } catch (err) {
      console.error('Erro ao carregar tendências:', err);
      setHabilidadesMaisBuscadas([]);
      setTendenciasSaoFallback(true);
    }
  };

  // Abre o formulário de edição, repopulando os campos com os dados atuais.
  const abrirEdicao = () => {
    if (!usuario) return;
    setNome(usuario.nome);
    setEmail(usuario.email);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarNovaSenha('');
    setErro(null);
    setEditando(true);
  };

  // Valida e envia as alterações de perfil (nome, e-mail e/ou senha).
  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (novaSenha && novaSenha !== confirmarNovaSenha) {
      setErro('As senhas novas não coincidem.');
      return;
    }
    if (novaSenha && novaSenha.length < 8) {
      setErro('A nova senha precisa ter no mínimo 8 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      await api.patch(`/usuarios/${usuarioId}/perfil`, {
        nome,
        email,
        senhaAtual,
        novaSenha: novaSenha || undefined,
      });

      const salvo = localStorage.getItem('@WorkMatch:user');
      if (salvo) {
        const dados = JSON.parse(salvo);
        localStorage.setItem('@WorkMatch:user', JSON.stringify({ ...dados, nome, email }));
      }

      setEditando(false);
      setSucesso('Perfil atualizado com sucesso!');
      setTimeout(() => setSucesso(null), 3000);
      await carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error ?? 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  };

  // Lista única e ordenada de todas as habilidades cadastradas no sistema (todas as categorias).
  const todasAsHabilidadesDoSistema = useMemo(() => {
    return (categorias || [])
      .flatMap(c => {
        if (!c || !Array.isArray(c.habilidades)) return [];
        return c.habilidades.map(h => (h && h.nome ? String(h.nome).trim() : ''));
      })
      .filter((value, index, self) => value !== '' && self.indexOf(value) === index)
      .sort();
  }, [categorias]);

  // Sugestões de autocomplete: habilidades do sistema que combinam com o
  // texto digitado e que o usuário ainda não possui.
  const sugestoesFiltradas = useMemo(() => {
    const termoDigitado = removerAcentosETermo(novaHabilidade);
    if (!termoDigitado) return [];

    return todasAsHabilidadesDoSistema.filter(hab => {
      const habilidadeDoSistema = removerAcentosETermo(hab);
      const jaPossui = (usuario?.competencias || []).some(c => removerAcentosETermo(c) === habilidadeDoSistema);
      return habilidadeDoSistema.indexOf(termoDigitado) !== -1 && !jaPossui;
    });
  }, [novaHabilidade, todasAsHabilidadesDoSistema, usuario?.competencias]);

  const textoTratadoInput = removerAcentosETermo(novaHabilidade);
  const existeNoSistema = todasAsHabilidadesDoSistema.some(h => removerAcentosETermo(h) === textoTratadoInput);
  const jaAdicionado = (usuario?.competencias || []).some(c => removerAcentosETermo(c) === textoTratadoInput);
  const limiteAtingido = (usuario?.competencias || []).length >= 10;

  const botaoAdicionarHabilitado = existeNoSistema && !jaAdicionado && !limiteAtingido && novaHabilidade.trim() !== '';

  // Retorna o nome da habilidade com a grafia original cadastrada no
  // sistema, ou o texto digitado caso não exista correspondência exata.
  const obterNomeOriginalDoSistema = (textoDigitado: string) => {
    const encontrado = todasAsHabilidadesDoSistema.find(h => removerAcentosETermo(h) === removerAcentosETermo(textoDigitado));
    return encontrado || textoDigitado.trim();
  };

  // Adiciona a habilidade selecionada/digitada ao perfil do usuário.
  const adicionarHabilidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botaoAdicionarHabilitado || !usuario) return;

    const nomeFinalHabilidade = obterNomeOriginalDoSistema(novaHabilidade);
    setEnviandoHabilidade(true);

    try {
      await api.post(`/usuarios/${usuarioId}/competencias`, { nome: nomeFinalHabilidade });
      setUsuario({
        ...usuario,
        competencias: [...usuario.competencias, nomeFinalHabilidade]
      });
      setNovaHabilidade('');
      setMostrarSugestoes(false);
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Não foi possível adicionar a habilidade.');
    } finally {
      setEnviandoHabilidade(false);
    }
  };

  // Remove uma habilidade do perfil do usuário.
  const removerHabilidade = async (nomeHabilidade: string) => {
    if (!usuario) return;
    try {
      await api.delete(`/usuarios/${usuarioId}/competencias/${encodeURIComponent(nomeHabilidade)}`);
      setUsuario({
        ...usuario,
        competencias: usuario.competencias.filter(h => h !== nomeHabilidade)
      });
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Não foi possível remover a habilidade.');
    }
  };

  if (erroCarregamento) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '12px' }}>{erroCarregamento}</p>
        <button style={s.btnPrimario} onClick={inicializar}>Tentar novamente</button>
      </div>
    );
  }

  if (carregando && !usuario) return <p style={{ fontSize: '14px', color: 'var(--text)' }}>Carregando perfil...</p>;
  if (!usuario) return <p style={{ fontSize: '14px', color: 'var(--text)' }}>Não foi possível carregar o perfil.</p>;

  return (
    <div style={s.containerLayout}>

      {/* Grid superior em coluna invertida: o bloco de Perfil aparece
          visualmente no topo, mas vem depois no DOM (column-reverse). */}
      <div style={s.gridSuperior}>

        {/* Bloco de Habilidades */}
        <div style={s.colunaHabilidades}>
          <h2 style={s.titulo}>Habilidades</h2>
          <div style={s.card}>
            {usuario.competencias.length === 0 ? (
              <p style={s.vazio}>Nenhuma habilidade cadastrada ainda. Adicione até 10 para receber indicações melhores.</p>
            ) : (
              <div style={s.tagsContainer}>
                {usuario.competencias.map(hab => (
                  <span key={hab} style={s.tag}>
                    {hab}
                    <button style={s.tagRemover} onClick={() => removerHabilidade(hab)} title="Remover">×</button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ position: 'relative', width: '100%' }}>
              <form onSubmit={adicionarHabilidade} style={s.formHabilidade}>
                <input
                  style={s.input}
                  placeholder={limiteAtingido ? "Limite atingido" : "ex: Docker, Photoshop..."}
                  value={novaHabilidade}
                  onChange={e => {
                    setNovaHabilidade(e.target.value);
                    setMostrarSugestoes(true);
                  }}
                  onFocus={() => setMostrarSugestoes(true)}
                  disabled={limiteAtingido}
                />
                <button
                  type="submit"
                  style={botaoAdicionarHabilitado ? s.btnPrimario : s.btnDesabilitado}
                  disabled={enviandoHabilidade || !botaoAdicionarHabilitado}
                >
                  Adicionar
                </button>
              </form>

              {mostrarSugestoes && sugestoesFiltradas.length > 0 && !limiteAtingido && (
                <div style={s.autocompleteBox}>
                  {sugestoesFiltradas.map((sugestao) => {
                    const estáComHover = itemComHover === sugestao;
                    return (
                      <button
                        key={sugestao}
                        type="button"
                        style={{
                          ...s.autocompleteItem,
                          backgroundColor: estáComHover ? 'var(--code-bg)' : 'transparent',
                        }}
                        onMouseEnter={() => setItemComHover(sugestao)}
                        onMouseLeave={() => setItemComHover(null)}
                        onClick={() => {
                          setNovaHabilidade(sugestao);
                          setMostrarSugestoes(false);
                        }}
                      >
                        {sugestao}
                      </button>
                    );
                  })}
                </div>
              )}

              {mostrarSugestoes && (
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} 
                  onClick={() => setMostrarSugestoes(false)} 
                />
              )}
            </div>
          </div>
        </div>

        {/* Bloco de Perfil */}
        <div style={s.colunaPerfil}>
          <div style={s.topo}>
            <h2 style={s.titulo}>Perfil</h2>
            {!editando && (
              <button style={s.btnEditarPerfil} onClick={abrirEdicao}>Editar perfil</button>
            )}
          </div>

          {sucesso && <div style={s.avisoSucesso}>{sucesso}</div>}

          {!editando ? (
            <div style={s.card}>
              <div style={s.linhaCampo}>
                <span style={s.label}>ID</span>
                <span style={s.valor}>{usuario.id}</span>
              </div>
              <div style={s.linhaCampo}>
                <span style={s.label}>Nome</span>
                <span style={s.valor}>{usuario.nome}</span>
              </div>
              <div style={s.linhaCampo}>
                <span style={s.label}>E-mail</span>
                <span style={s.valor}>{usuario.email}</span>
              </div>
              <div style={s.linhaCampo}>
                <span style={s.label}>Nível de experiência</span>
                <span style={s.valor}>{LABEL_NIVEL[usuario.nivelExperiencia]}</span>
              </div>
              <div style={s.linhaCampo}>
                <span style={s.label}>Serviços concluídos</span>
                <span style={s.valor}>{usuario.totalServicosConcluidos}</span>
              </div>
              <div style={s.linhaCampo}>
                <span style={s.label}>Reputação como prestador</span>
                <span style={s.valor}><Estrela nota={usuario.reputacaoPrestador} /></span>
              </div>
              <div style={s.linhaCampo}>
                <span style={s.label}>Reputação como cliente</span>
                <span style={s.valor}><Estrela nota={usuario.reputacaoCliente} /></span>
              </div>
            </div>
          ) : (
            <form onSubmit={salvarEdicao} style={s.card} autoComplete="off">
              <div style={s.campo}>
                <label style={s.labelForm}>ID</label>
                <input style={{ ...s.input, opacity: 0.6 }} value={usuario.id} disabled />
                <span style={s.ajuda}>O ID não pode ser alterado.</span>
              </div>

              <div style={s.campo}>
                <label style={s.labelForm}>Nome</label>
                <input style={s.input} value={nome} onChange={e => setNome(e.target.value)} required />
              </div>

              <div style={s.campo}>
                <label style={s.labelForm}>E-mail</label>
                <input type="email" style={s.input} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <div style={s.separador} />

              <div style={s.campo}>
                <label style={s.labelForm}>Senha atual (obrigatória para salvar)</label>
                <input 
                  type="password" 
                  style={s.input} 
                  value={senhaAtual} 
                  onChange={e => setSenhaAtual(e.target.value)} 
                  required 
                  autoComplete="new-password"
                />
              </div>

              <div style={s.grid2}>
                <div style={s.campo}>
                  <label style={s.labelForm}>Nova senha (opcional)</label>
                  <input 
                    type="password" 
                    style={s.input} 
                    value={novaSenha} 
                    onChange={e => setNovaSenha(e.target.value)} 
                    placeholder="Deixe em branco para manter" 
                    autoComplete="new-password"
                  />
                </div>
                <div style={s.campo}>
                  <label style={s.labelForm}>Confirmar nova senha</label>
                  <input 
                    type="password" 
                    style={s.input} 
                    value={confirmarNovaSenha} 
                    onChange={e => setConfirmarNovaSenha(e.target.value)} 
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {erro && <p style={s.erro}>{erro}</p>}

              <div style={s.acoes}>
                <button type="button" style={s.btnSecundario} onClick={() => setEditando(false)}>Cancelar</button>
                <button style={s.btnPrimario} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Seção inferior: tendências de mercado */}
      <div style={s.secaoMercado}>
        <h3 style={s.tituloMercado}>Habilidades mais buscadas atualmente</h3>
        {tendenciasSaoFallback ? (
          <p style={s.subtituloMercado}>Ainda não há demandas suficientes para calcular as tendências. Confira aqui as habilidades mais procuradas em breve!</p>
        ) : (
          <>
            <p style={s.subtituloMercado}>Essas competências são as que mais aparecem nas demandas ativas do sistema. Clique em uma para pesquisá-la rapidamente:</p>
            <div style={s.tagsMercadoContainer}>
              {habilidadesMaisBuscadas.map(hab => (
                <button
                  key={hab}
                  type="button"
                  style={s.tagMercado}
                  onClick={() => {
                    if (!limiteAtingido) {
                      setNovaHabilidade(hab);
                      setMostrarSugestoes(true);
                    }
                  }}
                  disabled={limiteAtingido}
                >
                  🔥 {hab}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// Estilos da tela de Perfil.
const s: Record<string, React.CSSProperties> = {
  containerLayout: { display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '0 16px', boxSizing: 'border-box' },
  btnEditarPerfil: { backgroundColor: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, fontSize: '14px',cursor: 'pointer', transition: 'background-color 0.2s ease' },
  gridSuperior: { display: 'flex', flexDirection: 'column-reverse', gap: '32px', width: '100%' },
  colunaHabilidades: { display: 'flex', flexDirection: 'column', gap: '16px' },
  colunaPerfil: { display: 'flex', flexDirection: 'column', gap: '16px' },
  topo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: '20px', fontWeight: 700, color: 'var(--text-h)', margin: 0, height: '36px', display: 'flex', alignItems: 'center' },
  card: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' },
  linhaCampo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)', fontSize: '14px' },
  label: { color: 'var(--text)' },
  valor: { color: 'var(--text-h)', fontWeight: 600 },
  campo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  labelForm: { fontSize: '12px', fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: 'var(--bg)', color: 'var(--text-h)', width: '100%', boxSizing: 'border-box' },
  ajuda: { fontSize: '11px', color: 'var(--text)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  separador: { height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' },
  erro: { fontSize: '13px', color: '#ef4444', margin: 0 },
  acoes: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  btnPrimario: { backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' },
  btnDesabilitado: { backgroundColor: '#cbd5e1', color: '#94a3b8', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 600, fontSize: '14px', cursor: 'not-allowed' },
  btnSecundario: { backgroundColor: 'var(--code-bg)', color: 'var(--text-h)', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' },
  avisoSucesso: { backgroundColor: '#dcfce7', color: '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },
  vazio: { fontSize: '13px', color: 'var(--text)' },
  tagsContainer: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  tag: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', backgroundColor: 'var(--code-bg)', padding: '5px 6px 5px 10px', borderRadius: '999px', color: 'var(--text-h)' },
  tagRemover: { background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '0 4px' },
  formHabilidade: { display: 'flex', gap: '8px' },
  autocompleteBox: { position: 'absolute', top: '44px', left: 0, right: 0, backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '160px', overflowY: 'auto', zIndex: 10, display: 'flex', flexDirection: 'column' },
  autocompleteItem: { padding: '10px 12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--text-h)', cursor: 'pointer', width: '100%', transition: 'background-color 0.15s ease' },
  secaoMercado: { backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '100%', boxSizing: 'border-box' },
  tituloMercado: { fontSize: '16px', fontWeight: 700, color: 'var(--text-h)', margin: '0 0 6px 0' },
  subtituloMercado: { fontSize: '13px', color: 'var(--text)', margin: '0 0 16px 0' },
  tagsMercadoContainer: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  tagMercado: { padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--code-bg)', color: 'var(--text-h)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease' }
};
