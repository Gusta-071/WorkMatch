/**
 * Repositório de Usuario.
 * Responsável pela persistência dos usuários e pela sincronização de suas
 * competências, delegando a reconstrução do objeto de domínio à própria
 * classe Usuario.
 */

import { prisma } from "../database/prisma";
import { Usuario } from "../domain/Usuario";

export class UsuarioRepository {

    // Salva um novo usuário no banco.
    async salvar(usuario: Usuario): Promise<void> {
        await prisma.usuario.create({
            data: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                senha: usuario.senha,
                reputacaoPrestador: usuario.reputacaoPrestador,
                totalAvaliacoesPrestador: usuario.totalAvaliacoesPrestador,
                reputacaoCliente: usuario.reputacaoCliente,
                totalAvaliacoesCliente: usuario.totalAvaliacoesCliente,
                totalServicosConcluidos: usuario.totalServicosConcluidos
            }
        });
    }

    // Busca um usuário pelo ID e reconstrói o objeto de domínio.
    async buscarPorId(id: string): Promise<Usuario | null> {
        const dados = await prisma.usuario.findUnique({
            where: { id },
            include: { competencias: true }
        });

        if (!dados) return null;
        return this.reconstituir(dados);
    }

    // Busca um usuário pelo e-mail e reconstrói o objeto de domínio.
    async buscarPorEmail(email: string): Promise<Usuario | null> {
        const dados = await prisma.usuario.findUnique({
            where: { email },
            include: { competencias: true }
        });

        if (!dados) return null;
        return this.reconstituir(dados);
    }

    // Atualiza os dados cadastrais e de reputação do usuário, e sincroniza
    // a lista de competências com a tabela (cria as novas, remove as excluídas).
    async atualizar(usuario: Usuario): Promise<void> {
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
                nome: usuario.nome,
                email: usuario.email,
                senha: usuario.senha,
                reputacaoPrestador: usuario.reputacaoPrestador,
                totalAvaliacoesPrestador: usuario.totalAvaliacoesPrestador,
                reputacaoCliente: usuario.reputacaoCliente,
                totalAvaliacoesCliente: usuario.totalAvaliacoesCliente,
                totalServicosConcluidos: usuario.totalServicosConcluidos
            }
        });

        const existentes = await prisma.competencia.findMany({ where: { usuarioId: usuario.id } });
        const nomesExistentes = new Set(existentes.map(c => c.nome));
        const nomesAtuais = usuario.competencias;

        const novas = nomesAtuais.filter(nome => !nomesExistentes.has(nome));
        const removidas = existentes.filter(c => !nomesAtuais.includes(c.nome));

        for (const nome of novas) {
            await prisma.competencia.create({
                data: { usuarioId: usuario.id, nome }
            });
        }

        for (const comp of removidas) {
            await prisma.competencia.delete({ where: { id: comp.id } });
        }
    }

    // Reconstrói o objeto de domínio Usuario a partir dos dados do banco,
    // delegando a validação/montagem ao factory method da própria classe.
    private reconstituir(dados: any): Usuario {
        return Usuario.reconstituir({
            id: dados.id,
            nome: dados.nome,
            email: dados.email,
            senha: dados.senha,
            reputacaoPrestador: dados.reputacaoPrestador,
            totalAvaliacoesPrestador: dados.totalAvaliacoesPrestador,
            reputacaoCliente: dados.reputacaoCliente,
            totalAvaliacoesCliente: dados.totalAvaliacoesCliente,
            totalServicosConcluidos: dados.totalServicosConcluidos,
            competencias: dados.competencias.map((comp: any) => comp.nome)
        });
    }
}