/**
 * Entidade Orcamento.
 * Representa uma proposta de valor feita por um prestador (ou cliente) para
 * uma Demanda, controlando o fluxo de negociação, aceite e recusa.
 */

import { Usuario } from "./Usuario";
import { Demanda } from "./Demanda";

export enum StatusOrcamento {
    PENDENTE = "PENDENTE",
    ACEITO = "ACEITO",
    RECUSADO = "RECUSADO",
    EXCLUIDO = "EXCLUIDO",
}

export type AutorProposta = "PRESTADOR" | "CLIENTE";

export class Orcamento {
    public readonly id: string;
    public readonly demanda: Demanda;
    public readonly prestador: Usuario;

    // Estado interno protegido, acessível apenas via getters/métodos da classe.
    private _valorProposto: number;
    private _mensagem: string | null;
    private _status: StatusOrcamento = StatusOrcamento.PENDENTE;
    private _ultimaPropostaPor: AutorProposta = "PRESTADOR";

    private _dataCriacao: Date = new Date();
    private _dataAtualizacao: Date = new Date();

    // Construtor: cria um novo orçamento para uma demanda, validando o valor proposto.
    constructor(
        id: string,
        demanda: Demanda,
        prestador: Usuario,
        valorProposto: number,
        mensagem: string | null = null,
    ) {
        if (valorProposto <= 0) throw new Error("O valor proposto deve ser maior que zero.");

        this.id = id;
        this.demanda = demanda;
        this.prestador = prestador;
        this._valorProposto = valorProposto;
        this._mensagem = mensagem;
    }

    // ─── FACTORY METHOD PARA RECONSTITUIÇÃO DO BANCO ──────────────────────────

    // Reconstrói um orçamento existente a partir dos dados persistidos no banco.
    public static reconstituir(dados: {
        id: string;
        demanda: Demanda;
        prestador: Usuario;
        valorProposto: number;
        mensagem: string | null;
        status: StatusOrcamento;
        ultimaPropostaPor: AutorProposta;
        dataCriacao: Date;
        dataAtualizacao: Date;
    }): Orcamento {
        const o = Object.create(Orcamento.prototype);

        Object.assign(o, {
            id: dados.id,
            demanda: dados.demanda,
            prestador: dados.prestador,
            _valorProposto: dados.valorProposto,
            _mensagem: dados.mensagem,
            _status: dados.status,
            _ultimaPropostaPor: dados.ultimaPropostaPor,
            _dataCriacao: dados.dataCriacao,
            _dataAtualizacao: dados.dataAtualizacao
        });

        return o;
    }

    // ─── GETTERS ───────────────────────────────────────────────────────────

    public get valorProposto() { return this._valorProposto; }
    public get mensagem() { return this._mensagem; }
    public get status() { return this._status; }
    public get ultimaPropostaPor() { return this._ultimaPropostaPor; }
    public get dataCriacao() { return this._dataCriacao; }
    public get dataAtualizacao() { return this._dataAtualizacao; }

    // ─── COMPORTAMENTOS (MÉTODOS DE NEGÓCIO) ──────────────────────────────────

    // Aceita o orçamento, desde que ainda esteja pendente.
    public aceitar(): void {
        if (this._status !== StatusOrcamento.PENDENTE) {
            throw new Error("Só é possível aceitar um orçamento pendente.");
        }
        this._status = StatusOrcamento.ACEITO;
        this._dataAtualizacao = new Date();
    }

    // Registra uma contraproposta, alternando o turno entre prestador e cliente.
    public contrapropor(novoValor: number, mensagem: string | null = null, autor: AutorProposta): void {
        if (this._status !== StatusOrcamento.PENDENTE) {
            throw new Error("Só é possível fazer uma contraproposta para um orçamento pendente.");
        }
        if (novoValor <= 0) throw new Error("O valor da contraproposta deve ser maior que zero.");
        if (this._ultimaPropostaPor === autor) {
            throw new Error("Aguarde a resposta do outro lado antes de fazer uma nova contraproposta.");
        }

        this._valorProposto = novoValor;
        if (mensagem !== null) this._mensagem = mensagem;
        this._ultimaPropostaPor = autor;
        this._dataAtualizacao = new Date();
    }

    // Recusa o orçamento, desde que ainda esteja pendente.
    public recusar(mensagem: string | null = null): void {
        if (this._status !== StatusOrcamento.PENDENTE) {
            throw new Error("Só é possível recusar um orçamento pendente.");
        }
        this._status = StatusOrcamento.RECUSADO;
        if (mensagem !== null) this._mensagem = mensagem;
        this._dataAtualizacao = new Date();
    }

    // Reabre um orçamento recusado com uma nova proposta de valor.
    public reabrirAposRecusa(valorProposto: number, mensagem: string | null = null): void {
        if (this._status !== StatusOrcamento.RECUSADO) {
            throw new Error("Só é possível reabrir um orçamento que foi recusado.");
        }
        if (valorProposto <= 0) throw new Error("O valor proposto deve ser maior que zero.");

        this._status = StatusOrcamento.PENDENTE;
        this._valorProposto = valorProposto;
        this._ultimaPropostaPor = "PRESTADOR";
        this._mensagem = mensagem;
        this._dataAtualizacao = new Date();
    }

    // Exclui definitivamente um orçamento já recusado.
    public excluir(): void {
        if (this._status !== StatusOrcamento.RECUSADO) {
            throw new Error("Só é possível excluir um orçamento que já foi recusado pelo cliente.");
        }
        this._status = StatusOrcamento.EXCLUIDO;
        this._dataAtualizacao = new Date();
    }
}