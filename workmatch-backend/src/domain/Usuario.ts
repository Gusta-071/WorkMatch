/**
 * Entidade Usuario.
 * Representa um usuário do sistema (cliente e/ou prestador), controlando
 * reputação, competências e progresso de serviços concluídos.
 */

import { NivelExperiencia, calcularNivelPorServicosConcluidos } from "./NivelExperiencia";

export class Usuario {
    // Dados de identificação, de leitura livre.
    public readonly id: string;
    public nome: string;
    public email: string;
    public senha: string;

    // Estado interno protegido, acessível apenas via getters/métodos da classe.
    private _reputacaoPrestador: number = 5.0;
    private _totalAvaliacoesPrestador: number = 1;

    private _reputacaoCliente: number = 5.0;
    private _totalAvaliacoesCliente: number = 1;

    private _competencias: Set<string> = new Set();
    private _totalServicosConcluidos: number = 0;

    // Construtor: cria um novo usuário no sistema.
    constructor(id: string, nome: string, email: string, senha: string) {
        this.id = id;
        this.nome = nome;
        this.email = email;
        this.senha = senha;
    }

    // ─── FACTORY METHOD PARA RECONSTITUIÇÃO ──────────────────────────────────

    // Reconstrói um usuário existente a partir dos dados persistidos no banco.
    public static reconstituir(dados: {
        id: string;
        nome: string;
        email: string;
        senha: string;
        reputacaoPrestador: number;
        totalAvaliacoesPrestador: number;
        reputacaoCliente: number;
        totalAvaliacoesCliente: number;
        totalServicosConcluidos: number;
        competencias: string[];
    }): Usuario {
        const usuario = new Usuario(dados.id, dados.nome, dados.email, dados.senha);

        usuario._reputacaoPrestador = dados.reputacaoPrestador;
        usuario._totalAvaliacoesPrestador = dados.totalAvaliacoesPrestador;
        usuario._reputacaoCliente = dados.reputacaoCliente;
        usuario._totalAvaliacoesCliente = dados.totalAvaliacoesCliente;
        usuario._totalServicosConcluidos = dados.totalServicosConcluidos;
        usuario._competencias = new Set(dados.competencias);

        return usuario;
    }

    // ─── GETTERS ───────────────────────────────────────────────────────────

    public get reputacaoPrestador(): number { return this._reputacaoPrestador; }
    public get totalAvaliacoesPrestador(): number { return this._totalAvaliacoesPrestador; }
    public get reputacaoCliente(): number { return this._reputacaoCliente; }
    public get totalAvaliacoesCliente(): number { return this._totalAvaliacoesCliente; }
    public get totalServicosConcluidos(): number { return this._totalServicosConcluidos; }

    // Retorna uma cópia em array para evitar alteração externa do Set original.
    public get competencias(): string[] {
        return Array.from(this._competencias);
    }

    // ─── COMPORTAMENTOS (MÉTODOS DE NEGÓCIO) ─────────────────────────────────

    // Incrementa o contador de serviços concluídos (chamado pela Demanda ao finalizar).
    public incrementarServicosConcluidos(): void {
        this._totalServicosConcluidos++;
    }

    // Adiciona uma nova habilidade, respeitando o limite de 10 e evitando duplicatas.
    public adicionarHabilidade(nome: string): void {
        const nomeFormatado = nome.trim().toLowerCase();
        if (this._competencias.size >= 10) {
            throw new Error("Você atingiu o limite de 10 habilidades.");
        }
        if (this._competencias.has(nomeFormatado)) {
            throw new Error("Você já possui esta habilidade cadastrada.");
        }
        this._competencias.add(nomeFormatado);
    }

    // Remove uma habilidade previamente cadastrada.
    public removerHabilidade(nome: string): void {
        const nomeFormatado = nome.trim().toLowerCase();
        if (!this._competencias.has(nomeFormatado)) {
            throw new Error("Você não possui esta habilidade cadastrada.");
        }
        this._competencias.delete(nomeFormatado);
    }

    // Registra uma nova avaliação recebida como prestador, atualizando a média de reputação.
    public receberAvaliacaoPrestador(nota: number): void {
        if (nota < 0 || nota > 5) throw new Error("A nota deve ser entre 0 e 5.");
        this._reputacaoPrestador = ((this._reputacaoPrestador * this._totalAvaliacoesPrestador) + nota) / (this._totalAvaliacoesPrestador + 1);
        this._totalAvaliacoesPrestador++;
    }

    // Registra uma nova avaliação recebida como cliente, atualizando a média de reputação.
    public receberAvaliacaoCliente(nota: number): void {
        if (nota < 0 || nota > 5) throw new Error("A nota deve ser entre 0 e 5.");
        this._reputacaoCliente = ((this._reputacaoCliente * this._totalAvaliacoesCliente) + nota) / (this._totalAvaliacoesCliente + 1);
        this._totalAvaliacoesCliente++;
    }

    // Retorna o nível de experiência atual, calculado a partir dos serviços concluídos.
    public getNivelExperiencia(): NivelExperiencia {
        return calcularNivelPorServicosConcluidos(this._totalServicosConcluidos);
    }
}