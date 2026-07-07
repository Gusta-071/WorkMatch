/**
 * Níveis de experiência dos profissionais.
 * Define a escala de experiência (baseada no total de serviços concluídos),
 * as taxas cobradas por nível e a função que classifica o profissional.
 */

// Nível de experiência do profissional. Também é usado na Demanda como
// "nível mínimo exigido", definindo a taxa aplicada sobre o valor do serviço.
export enum NivelExperiencia {
    INICIANTE = "INICIANTE",
    INTERMEDIARIO = "INTERMEDIARIO",
    AVANCADO = "AVANCADO",
    ESPECIALISTA = "ESPECIALISTA",
}

// Taxa adicional sobre o valor estimado, travada no nível mínimo escolhido
// pelo cliente, independentemente do nível real do profissional que aceitar.
export const TAXA_POR_NIVEL: Record<NivelExperiencia, number> = {
    [NivelExperiencia.INICIANTE]: 0,
    [NivelExperiencia.INTERMEDIARIO]: 0.05,
    [NivelExperiencia.AVANCADO]: 0.10,
    [NivelExperiencia.ESPECIALISTA]: 0.20,
};

// Classifica o nível de experiência de um profissional com base no total
// de serviços concluídos.
export function calcularNivelPorServicosConcluidos(totalServicosConcluidos: number): NivelExperiencia {
    if (totalServicosConcluidos <= 5) return NivelExperiencia.INICIANTE;
    if (totalServicosConcluidos <= 15) return NivelExperiencia.INTERMEDIARIO;
    if (totalServicosConcluidos <= 30) return NivelExperiencia.AVANCADO;
    return NivelExperiencia.ESPECIALISTA;
}