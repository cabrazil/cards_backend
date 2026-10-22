import { FastifyInstance } from 'fastify'
import { extractCardInfo, ExtractedCardData } from '../services/cardExtractor'
import {
  saveExtractedCardToDb,
  findExistingCardMatch,
  cleanKnownDuplicates,
} from '../services/cardPersistence'

export async function adminCardRoutes(app: FastifyInstance) {
  // 1. Apenas extrair (para revisão visual no admin antes de salvar)
  app.post<{
    Body: {
      text: string
      model?: string
      useWebSearch?: boolean
    }
  }>('/extract', async (request, reply) => {
    const { text, model, useWebSearch } = request.body

    const minLength = useWebSearch ? 3 : 20
    if (!text || text.trim().length < minLength) {
      reply.code(400)
      return {
        error: useWebSearch
          ? 'Informe o nome do cartão para buscar na web (mínimo 3 caracteres).'
          : 'O texto do cartão deve ter pelo menos 20 caracteres.'
      }
    }

    try {
      const extracted = await extractCardInfo(text, model, useWebSearch)

      // Detectar se este cartão ESPECÍFICO já existe na base (mesmo nome ou slug)
      const existingMatch = await findExistingCardMatch(extracted.card.name, extracted.card.slug)

      return {
        ok: true,
        data: extracted,
        existingMatch: existingMatch
          ? { id: existingMatch.id, name: existingMatch.name, slug: existingMatch.slug }
          : null,
      }
    } catch (err: any) {
      reply.code(500)
      return { error: err.message || 'Erro ao extrair informações do cartão.' }
    }
  })

  // 2. Salvar dados revisados no banco
  app.post<{
    Body: {
      data: ExtractedCardData
      targetCardId?: number | null
      forceNew?: boolean
    }
  }>('/save', async (request, reply) => {
    const { data, targetCardId, forceNew } = request.body

    if (!data || !data.card || !data.card.name) {
      reply.code(400)
      return { error: 'Dados do cartão incompletos para salvamento.' }
    }

    try {
      const { card, isUpdate, matchedExistingCard } = await saveExtractedCardToDb(data, {
        targetCardId,
        forceNew,
      })
      const actionText = isUpdate ? 'atualizado' : 'cadastrado'
      return {
        ok: true,
        message: `Cartão "${card.name}" ${actionText} com sucesso no PostgreSQL!`,
        card,
        isUpdate,
        matchedExistingCard,
      }
    } catch (err: any) {
      reply.code(500)
      return { error: err.message || 'Erro ao persistir cartão no banco.' }
    }
  })

  // 3. Limpar duplicidades conhecidas na base
  app.post('/clean-duplicates', async () => {
    return await cleanKnownDuplicates()
  })

  // 3. Extrair e Salvar direto em 1 clique
  app.post<{
    Body: {
      text: string
      model?: string
      useWebSearch?: boolean
    }
  }>('/extract-and-save', async (request, reply) => {
    const { text, model, useWebSearch } = request.body

    const minLength = useWebSearch ? 3 : 20
    if (!text || text.trim().length < minLength) {
      reply.code(400)
      return {
        error: useWebSearch
          ? 'Informe o nome do cartão para buscar na web (mínimo 3 caracteres).'
          : 'O texto do cartão é obrigatório.'
      }
    }

    try {
      const extracted = await extractCardInfo(text, model, useWebSearch)
      const { card, isUpdate } = await saveExtractedCardToDb(extracted)
      const actionText = isUpdate ? 'atualizado' : 'cadastrado'
      return {
        ok: true,
        message: `Cartão "${card.name}" extraído e ${actionText} com sucesso!`,
        card,
        isUpdate,
        extracted,
      }
    } catch (err: any) {
      reply.code(500)
      return { error: err.message || 'Erro no processo de extração e salvamento.' }
    }
  })
}
