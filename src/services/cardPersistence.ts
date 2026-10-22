import prisma from '../lib/prisma'
import { ExtractedCardData, sanitizeTextCitations } from './cardExtractor'
import { Segment, CardStatus } from '@prisma/client'

/**
 * Normaliza um slug ou nome removendo stop-words e ordenando os tokens alfabeticamente.
 * Garante que "Nubank Mastercard Black Ultravioleta" e "Nubank Ultravioleta Mastercard Black"
 * gerem a mesma chave canônica: "black-mastercard-nubank-ultravioleta".
 */
export function normalizeSortedTokens(str: string): string {
  const stopWords = new Set(['cartao', 'cartão', 'de', 'credito', 'crédito', 'do', 'da', 'e', 'o', 'a', 'com', 'card'])
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/portobank/g, 'porto bank')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.has(w))
    .sort()
    .join('-')
}

export async function findExistingCardMatch(name: string, slug?: string, issuerId?: number) {
  // 1. Busca exata por slug ou por nome
  const exact = await prisma.card.findFirst({
    where: {
      OR: [
        ...(slug ? [{ slug }] : []),
        { name: { equals: name, mode: 'insensitive' as const } },
      ],
    },
  })
  if (exact) return exact

  // 2. Busca inteligente por tokens normalizados e ordenados
  const targetTokens = normalizeSortedTokens(slug || name)
  const candidateCards = await prisma.card.findMany({
    where: issuerId ? { issuerId } : undefined,
    select: { id: true, name: true, slug: true },
  })

  for (const cand of candidateCards) {
    if (normalizeSortedTokens(cand.slug) === targetTokens || normalizeSortedTokens(cand.name) === targetTokens) {
      return await prisma.card.findUnique({ where: { id: cand.id } })
    }
  }

  // 3. Se ainda não achou e issuerId foi fornecido, tenta também sem restrição de issuer
  if (issuerId) {
    const allCandidates = await prisma.card.findMany({
      select: { id: true, name: true, slug: true },
    })
    for (const cand of allCandidates) {
      if (normalizeSortedTokens(cand.slug) === targetTokens || normalizeSortedTokens(cand.name) === targetTokens) {
        return await prisma.card.findUnique({ where: { id: cand.id } })
      }
    }
  }

  return null
}

export interface SaveCardOptions {
  targetCardId?: number | null
  forceNew?: boolean
}

export async function saveExtractedCardToDb(
  rawData: ExtractedCardData,
  options: SaveCardOptions = {}
) {
  // Limpar qualquer link em markdown ou URL residual antes de persistir no banco
  const data = sanitizeTextCitations(rawData) as ExtractedCardData
  const { card: c, zeroFees, rewards, lounges, criterionScores } = data
  const { targetCardId, forceNew } = options

  // 1. Garantir que o Emissor existe
  const issuer = await prisma.issuer.upsert({
    where: { name: c.issuerName },
    update: {},
    create: {
      name: c.issuerName,
      type: 'BANCO_COMERCIAL',
    },
  })

  // 2. Garantir que a Bandeira existe
  const brand = await prisma.brand.upsert({
    where: {
      name_variant: {
        name: c.brandName,
        variant: c.brandVariant,
      },
    },
    update: {},
    create: {
      name: c.brandName,
      variant: c.brandVariant,
      benefits: [],
    },
  })

  // 3. Determinar se é atualização de cartão existente ou criação de novo
  let existing: any = null

  if (targetCardId) {
    // Usuário escolheu explicitamente atualizar este cartão específico
    existing = await prisma.card.findUnique({ where: { id: targetCardId } })
  } else if (!forceNew) {
    // Apenas tenta atualizar se for EXATAMENTE o mesmo slug ou nome idêntico
    existing = await prisma.card.findFirst({
      where: {
        OR: [
          { slug: c.slug },
          { name: { equals: c.name, mode: 'insensitive' } },
        ],
      },
    })
  }

  // Garantir slug único se for novo cartão
  let finalSlug = existing ? existing.slug : c.slug
  if (!existing) {
    const slugCollision = await prisma.card.findUnique({ where: { slug: finalSlug } })
    if (slugCollision) {
      finalSlug = `${c.slug}-${Date.now().toString().slice(-4)}`
    }
  }

  const cardPayload = {
    name: c.name,
    slug: finalSlug,
    status: (c.status || 'ACTIVE') as CardStatus,
    segment: (c.segment || 'ALTA_RENDA') as Segment,
    category: c.category || 'BLACK',
    annualFee: Number(c.annualFee) || 0,
    spreadRate: Number(c.spreadRate) || 0,
    pointsExpire: Boolean(c.pointsExpire),
    pointsAccelerator: Boolean(c.pointsAccelerator),
    rankPoints: Math.round(Number(c.rankPoints) || 1),
    rankBenefits: Math.round(Number(c.rankBenefits) || 1),
    rankAnnuity: Math.round(Number(c.rankAnnuity) || 1),
    rankMilesProgram: Math.round(Number(c.rankMilesProgram) || 1),
    rankVipLounges: Number(c.rankVipLounges) || 1,
    vipLoungeApp: c.vipLoungeApp || null,
    obsSummary: Array.isArray(c.obsSummary) ? c.obsSummary : [],
    issuerId: issuer.id,
    brandId: brand.id,
  }

  let savedCard: any

  if (existing) {
    savedCard = await prisma.card.update({
      where: { id: existing.id },
      data: cardPayload,
    })
  } else {
    savedCard = await prisma.card.create({
      data: cardPayload,
    })
  }

  const cardId = savedCard.id

  // 4. Atualizar Isenções (ZeroFees) com sanitização de feeDiscount
  await prisma.zeroFee.deleteMany({ where: { cardId } })
  for (const zf of zeroFees) {
    const feeDiscount = typeof zf.feeDiscount === 'number' && !isNaN(zf.feeDiscount)
      ? Math.round(zf.feeDiscount)
      : 100 // Padrão 100% de desconto se não especificado ou se for regra de isenção

    await prisma.zeroFee.create({
      data: {
        cardId,
        expenses: zf.expenses || null,
        investments: zf.investments || null,
        feeDiscount,
        conditions: Array.isArray(zf.conditions) ? zf.conditions.filter(Boolean) : [],
        notes: zf.notes || null,
      },
    })
  }

  // 5. Atualizar Recompensas/Pontos (Rewards)
  await prisma.reward.deleteMany({ where: { cardId } })
  for (const rw of rewards) {
    await prisma.reward.create({
      data: {
        cardId,
        expenses: rw.expenses || 'Geral',
        pointsPerDollar: Number(rw.pointsPerDollar) || 0,
        pointsPerReal: Number(rw.pointsPerReal) || 0,
        rules: rw.rules || null,
        expiration: Boolean(rw.expiration),
        notes: rw.notes || null,
      },
    })
  }

  // 6. Atualizar Salas VIP (Lounges)
  await prisma.lounge.deleteMany({ where: { cardId } })
  for (const lg of lounges) {
    await prisma.lounge.create({
      data: {
        cardId,
        name: lg.name || 'Sala VIP',
        accessLimit: lg.accessLimit || 'Conforme regras da bandeira',
        conditions: lg.conditions || null,
        isPaid: Boolean(lg.isPaid),
      },
    })
  }

  // 7. Atualizar Scores de Critérios (card_criterion_scores)
  for (const [key, score] of Object.entries(criterionScores)) {
    const criterion = await prisma.criterion.findUnique({ where: { key } })
    if (criterion) {
      const numericScore = typeof score === 'number' && !isNaN(score) ? score : 5
      await prisma.cardCriterionScore.upsert({
        where: {
          cardId_criterionId: {
            cardId,
            criterionId: criterion.id,
          },
        },
        update: { score: numericScore },
        create: {
          cardId,
          criterionId: criterion.id,
          score: numericScore,
        },
      })
    }
  }

  return {
    card: savedCard,
    isUpdate: !!existing,
    matchedExistingCard: existing ? { id: existing.id, name: existing.name, slug: existing.slug } : null,
  }
}

export async function cleanKnownDuplicates() {
  const duplicatesToResolve = [
    { keepId: 55, removeId: 17, name: 'Nubank Ultravioleta' },
    { keepId: 56, removeId: 19, name: 'XP One Visa Infinite' },
    { keepId: 21, removeId: 2, name: 'Porto Bank Mastercard Black' },
    { keepId: 24, removeId: 3, name: 'C6 Carbon Mastercard Black' },
  ]

  const results: string[] = []

  for (const item of duplicatesToResolve) {
    const keepCard = await prisma.card.findUnique({ where: { id: item.keepId } })
    const removeCard = await prisma.card.findUnique({ where: { id: item.removeId } })

    if (!removeCard) {
      results.push(`[OK] ID ${item.removeId} já não existe.`)
      continue
    }

    if (!keepCard) {
      results.push(`[AVISO] ID de destino ${item.keepId} não encontrado.`)
      continue
    }

    // 1. Re-apontar recomendações e favoritos
    await prisma.recommendationCard.updateMany({
      where: { cardId: removeCard.id },
      data: { cardId: keepCard.id },
    })

    // 2. Resolver conflito de favoritos
    const existingFavorites = await prisma.userFavorite.findMany({
      where: { cardId: keepCard.id },
    })
    const existingUserIds = new Set(existingFavorites.map((f) => f.userId))

    await prisma.userFavorite.deleteMany({
      where: {
        cardId: removeCard.id,
        userId: { in: Array.from(existingUserIds) },
      },
    })

    await prisma.userFavorite.updateMany({
      where: { cardId: removeCard.id },
      data: { cardId: keepCard.id },
    })

    // 3. Deletar dependências filhas do duplicado
    await prisma.cardCriterionScore.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.zeroFee.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.reward.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.lounge.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.cardWallet.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.cardTag.deleteMany({ where: { cardId: removeCard.id } })

    // 4. Deletar cartão duplicado
    await prisma.card.delete({ where: { id: removeCard.id } })
    results.push(`[UNIFICADO] ID ${removeCard.id} ("${removeCard.name}") unificado no ID ${keepCard.id} ("${keepCard.name}")`)
  }

  const remainingCount = await prisma.card.count()
  return { ok: true, remainingCount, details: results }
}
