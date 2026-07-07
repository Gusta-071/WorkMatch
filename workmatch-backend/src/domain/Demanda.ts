/**
 * Entidade Demanda.
 * Representa um serviço solicitado por um cliente, controlando seu ciclo de
 * vida (aberta → negociação → aprovada → concluída) e as avaliações entre
 * contratante e prestador.
 */

import { Usuario } from "./Usuario";
import { NivelExperiencia, TAXA_POR_NIVEL } from "./NivelExperiencia";

export enum StatusDemanda {
    ABERTA = "ABERTA",
    NEGOCIACAO = "NEGOCIACAO",
    APROVADA = "APROVADA",
    CONCLUIDA = "CONCLUIDA",
    DESABILITADA = "DESABILITADA",
    EXCLUIDA = "EXCLUIDA",
}

// Prazo para avaliação automática após a conclusão do prestador.
const TRES_DIAS_EM_MS = 3 * 24 * 60 * 60 * 1000;

export class Demanda {
    public readonly id: string;
    public readonly contratante: Usuario;

    // Estado interno protegido, acessível apenas via getters/métodos da classe.
    private _prestadorEscolhido: Usuario | null = null;
    private _valorFinalAcordado: number;
    private _status: StatusDemanda = StatusDemanda.ABERTA;

    private _dataCriacao: Date = new Date();
    private _dataUltimaAtualizacao: Date = new Date();
    private _dataAprovacao: Date | null = null;
    private _dataEntregaPrestador: Date | null = null;
    private _prestadorConcluiuEm: Date | null = null;
    private _clienteAvaliouEm: Date | null = null;

    private _notaPrestadorParaCliente: number | null = null;
    private _notaClienteParaPrestador: number | null = null;

    // Dados cadastrais, de leitura e escrita livres.
    public titulo: string;
    public descricao: string;
    public valorEstimado: number | null;
    public categoriaId: number;
    public habilidadesExtras: string[];
    public prazoFinalizacao: Date;
    public nivelMinimoExigido: NivelExperiencia;
    public reputacaoMinimaExigida: number;

    // Construtor: cria uma nova demanda, validando valor estimado e prazo.
    constructor(
        id: string,
        contratante: Usuario,
        titulo: string,
        descricao: string,
        valorEstimado: number | null,
        categoriaId: number,
        habilidadesExtras: string[],
        prazoFinalizacao: Date,
        nivelMinimoExigido: NivelExperiencia = NivelExperiencia.INICIANTE,
        reputacaoMinimaExigida: number = 0,
    ) {
        // O valor estimado é opcional (cliente pode não saber o preço de mercado).
        // Quando informado, precisa ser um valor válido.
        if (valorEstimado !== null && valorEstimado <= 0) {
            throw new Error("O valor estimado deve ser maior que zero, ou não ser informado (a combinar).");
        }
        if (prazoFinalizacao.getTime() <= Date.now()) {
            throw new Error("O prazo de finalização deve ser uma data futura.");
        }

        this.id = id;
        this.contratante = contratante;
        this.titulo = titulo;
        this.descricao = descricao;
        this.valorEstimado = valorEstimado;
        this.categoriaId = categoriaId;
        this.habilidadesExtras = habilidadesExtras;
        this.prazoFinalizacao = prazoFinalizacao;
        this.nivelMinimoExigido = nivelMinimoExigido;
        this.reputacaoMinimaExigida = reputacaoMinimaExigida;
        this._valorFinalAcordado = 0;
    }

    // ─── FACTORY METHOD PARA RECONSTITUIÇÃO DO BANCO ──────────────────────────

    // Reconstrói uma demanda existente a partir dos dados persistidos no banco,
    // sem repetir as validações do construtor padrão.
    public static reconstituir(dados: {
        id: string;
        contratante: Usuario;
        prestadorEscolhido: Usuario | null;
        titulo: string;
        descricao: string;
        valorEstimado: number | null;
        valorFinalAcordado: number;
        status: StatusDemanda;
        categoriaId: number;
        habilidadesExtras: string[];
        prazoFinalizacao: Date;
        nivelMinimoExigido: NivelExperiencia;
        reputacaoMinimaExigida: number;
        dataCriacao: Date;
        dataUltimaAtualizacao: Date;
        dataAprovacao: Date | null;
        dataEntregaPrestador: Date | null;
        prestadorConcluiuEm: Date | null;
        clienteAvaliouEm: Date | null;
        notaPrestadorParaCliente: number | null;
        notaClienteParaPrestador: number | null;
    }): Demanda {
        const d = Object.create(Demanda.prototype);

        Object.assign(d, {
            id: dados.id,
            contratante: dados.contratante,
            titulo: dados.titulo,
            descricao: dados.descricao,
            valorEstimado: dados.valorEstimado,
            categoriaId: dados.categoriaId,
            habilidadesExtras: dados.habilidadesExtras,
            prazoFinalizacao: dados.prazoFinalizacao,
            nivelMinimoExigido: dados.nivelMinimoExigido,
            reputacaoMinimaExigida: dados.reputacaoMinimaExigida,
            _prestadorEscolhido: dados.prestadorEscolhido,
            _valorFinalAcordado: dados.valorFinalAcordado,
            _status: dados.status,
            _dataCriacao: dados.dataCriacao,
            _dataUltimaAtualizacao: dados.dataUltimaAtualizacao,
            _dataAprovacao: dados.dataAprovacao,
            _dataEntregaPrestador: dados.dataEntregaPrestador,
            _prestadorConcluiuEm: dados.prestadorConcluiuEm,
            _clienteAvaliouEm: dados.clienteAvaliouEm,
            _notaPrestadorParaCliente: dados.notaPrestadorParaCliente,
            _notaClienteParaPrestador: dados.notaClienteParaPrestador
        });

        return d;
    }

    // ─── GETTERS ───────────────────────────────────────────────────────────

    public get prestadorEscolhido() { return this._prestadorEscolhido; }
    public get valorFinalAcordado() { return this._valorFinalAcordado; }
    public get status() { return this._status; }
    public get dataCriacao() { return this._dataCriacao; }
    public get dataUltimaAtualizacao() { return this._dataUltimaAtualizacao; }
    public get dataAprovacao() { return this._dataAprovacao; }
    public get dataEntregaPrestador() { return this._dataEntregaPrestador; }
    public get prestadorConcluiuEm() { return this._prestadorConcluiuEm; }
    public get clienteAvaliouEm() { return this._clienteAvaliouEm; }
    public get notaPrestadorParaCliente() { return this._notaPrestadorParaCliente; }
    public get notaClienteParaPrestador() { return this._notaClienteParaPrestador; }

    // Calcula o valor estimado somado à taxa referente ao nível mínimo exigido.
    public get valorTotalComTaxas(): number | null {
        if (this.valorEstimado === null) return null;
        const taxa = TAXA_POR_NIVEL[this.nivelMinimoExigido] ?? 0;
        return this.valorEstimado * (1 + taxa);
    }

    // Retorna o valor vigente do serviço conforme o estágio da demanda
    // (null indica "a combinar", quando ainda não há valor definido).
    public get valorAtualDoServico(): number | null {
        return this._status === StatusDemanda.ABERTA ? this.valorTotalComTaxas : this._valorFinalAcordado;
    }

    // ─── COMPORTAMENTOS (MÉTODOS DE NEGÓCIO) ──────────────────────────────────

    // Move a demanda para o status de negociação.
    public entrarEmNegociacao(): void {
        if (this._status !== StatusDemanda.ABERTA && this._status !== StatusDemanda.NEGOCIACAO) {
            throw new Error("Não é possível negociar uma demanda que não está aberta.");
        }
        this._status = StatusDemanda.NEGOCIACAO;
        this._dataUltimaAtualizacao = new Date();
    }

    // Aprova o orçamento de um prestador, definindo o valor final acordado.
    public aprovarOrcamento(prestador: Usuario, valorAcordado: number): void {
        if (this._status !== StatusDemanda.ABERTA && this._status !== StatusDemanda.NEGOCIACAO) {
            throw new Error("Esta demanda não está aberta para aprovação de orçamentos.");
        }
        if (valorAcordado <= 0) throw new Error("O valor acordado deve ser maior que zero.");

        this._prestadorEscolhido = prestador;
        this._valorFinalAcordado = valorAcordado;
        this._status = StatusDemanda.APROVADA;
        this._dataAprovacao = new Date();
        this._dataUltimaAtualizacao = new Date();
    }

    // Registra a entrega do serviço pelo prestador.
    public prestadorEntregarServico(): void {
        if (this._status !== StatusDemanda.APROVADA) {
            throw new Error("O serviço só pode ser entregue se a demanda estiver APROVADA.");
        }
        this._dataEntregaPrestador = new Date();
        this._dataUltimaAtualizacao = new Date();
    }

    // Registra a avaliação do prestador sobre o cliente, após a entrega do serviço.
    public avaliarCliente(nota: number): void {
        if (!this._dataEntregaPrestador) {
            throw new Error("O prestador precisa registrar a entrega antes de poder avaliar o cliente.");
        }
        if (this._notaPrestadorParaCliente !== null) {
            throw new Error("Você já avaliou este cliente.");
        }

        this.contratante.receberAvaliacaoCliente(nota);
        this._notaPrestadorParaCliente = nota;
        this._prestadorConcluiuEm = new Date();
        this.verificarConclusaoCompleta();
    }

    // Registra a avaliação do cliente sobre o prestador, após este concluir sua parte.
    public avaliarPrestador(nota: number): void {
        if (!this._prestadorConcluiuEm) {
            throw new Error("O cliente só pode avaliar o prestador após este concluir a sua parte.");
        }
        if (this._notaClienteParaPrestador !== null) {
            throw new Error("Você já avaliou este prestador.");
        }
        if (!this._prestadorEscolhido) {
            throw new Error("Não há prestador associado a esta demanda.");
        }

        this._prestadorEscolhido.receberAvaliacaoPrestador(nota);
        this._prestadorEscolhido.incrementarServicosConcluidos();
        this._notaClienteParaPrestador = nota;
        this._clienteAvaliouEm = new Date();
        this.verificarConclusaoCompleta();
    }

    // Marca a demanda como concluída quando ambas as avaliações já foram registradas.
    private verificarConclusaoCompleta(): void {
        if (this._notaPrestadorParaCliente !== null && this._notaClienteParaPrestador !== null) {
            this._status = StatusDemanda.CONCLUIDA;
            this._dataUltimaAtualizacao = new Date();
        }
    }

    // Aplica avaliação automática (nota máxima) caso o prazo de 3 dias expire
    // sem que uma das partes tenha avaliado a outra.
    public verificarAvaliacaoAutomatica(): void {
        if (!this._prestadorConcluiuEm || this._status === StatusDemanda.CONCLUIDA) return;

        const prazoExpirado = Date.now() - this._prestadorConcluiuEm.getTime() > TRES_DIAS_EM_MS;
        if (!prazoExpirado) return;

        if (this._notaPrestadorParaCliente === null) {
            this.contratante.receberAvaliacaoCliente(5);
            this._notaPrestadorParaCliente = 5;
        }

        if (this._notaClienteParaPrestador === null && this._prestadorEscolhido) {
            this._prestadorEscolhido.receberAvaliacaoPrestador(5);
            this._prestadorEscolhido.incrementarServicosConcluidos();
            this._notaClienteParaPrestador = 5;
            this._clienteAvaliouEm = new Date();
        }

        this.verificarConclusaoCompleta();
    }

    // Desabilita a demanda, desde que ainda não tenha sido aprovada.
    public desabilitar(): void {
        if (this._status !== StatusDemanda.ABERTA && this._status !== StatusDemanda.NEGOCIACAO) {
            throw new Error("Só é possível desabilitar demandas que ainda não foram aprovadas.");
        }
        this._status = StatusDemanda.DESABILITADA;
        this._dataUltimaAtualizacao = new Date();
    }

    // Reativa uma demanda previamente desabilitada.
    public reativar(): void {
        if (this._status !== StatusDemanda.DESABILITADA) {
            throw new Error("Só é possível reativar demandas que estejam desabilitadas.");
        }
        this._status = StatusDemanda.ABERTA;
        this._dataUltimaAtualizacao = new Date();
    }

    // Exclui a demanda, desde que esteja aberta ou desabilitada.
    public excluir(): void {
        if (this._status !== StatusDemanda.DESABILITADA && this._status !== StatusDemanda.ABERTA) {
            throw new Error("Para excluir, a demanda precisa estar aberta ou desabilitada.");
        }
        this._status = StatusDemanda.EXCLUIDA;
        this._dataUltimaAtualizacao = new Date();
    }
}