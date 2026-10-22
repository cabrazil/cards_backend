import prisma from '../lib/prisma'

const cardScores: Record<string, Record<string, number>> = {
  'santander-unlimited-visa-infinite': {
    income_level: 9.5,
    monthly_spending: 9.0,
    investment_level: 8.0,
    prefers_miles: 10.0,
    prefers_cashback: 3.0,
    prefers_points: 9.5,
    prefers_low_fee: 2.0,
    travel_domestic: 9.0,
    travel_international: 10.0,
    values_lounge: 10.0,
    low_score_friendly: 1.0,
    no_income_proof: 2.0,
    beginner_friendly: 1.0,
    digital_first: 3.0,
    traditional_bank: 9.0,
    international_purchase: 9.5,
    spread_rate_quality: 4.0,
    insurance_coverage: 10.0,
    additional_cards: 9.0,
  },
  'portobank-mastercard-black': {
    income_level: 8.5,
    monthly_spending: 8.5,
    investment_level: 7.0,
    prefers_miles: 9.0,
    prefers_cashback: 4.0,
    prefers_points: 8.5,
    prefers_low_fee: 3.0,
    travel_domestic: 8.5,
    travel_international: 9.0,
    values_lounge: 9.0,
    low_score_friendly: 2.0,
    no_income_proof: 3.0,
    beginner_friendly: 2.0,
    digital_first: 2.0,
    traditional_bank: 8.0,
    international_purchase: 8.5,
    spread_rate_quality: 5.0,
    insurance_coverage: 9.5,
    additional_cards: 8.0,
  },
  'c6-carbon-mastercard': {
    income_level: 8.0,
    monthly_spending: 8.0,
    investment_level: 8.5,
    prefers_miles: 8.5,
    prefers_cashback: 8.0,
    prefers_points: 8.5,
    prefers_low_fee: 5.0,
    travel_domestic: 8.0,
    travel_international: 8.5,
    values_lounge: 8.5,
    low_score_friendly: 3.0,
    no_income_proof: 5.0,
    beginner_friendly: 3.0,
    digital_first: 9.0,
    traditional_bank: 2.0,
    international_purchase: 8.0,
    spread_rate_quality: 8.0, // C6 tem spread baixo
    insurance_coverage: 9.0,
    additional_cards: 9.5, // 6 adicionais grátis
  },
  'c6-mastercard-black': {
    income_level: 6.0,
    monthly_spending: 6.0,
    investment_level: 5.0,
    prefers_miles: 6.5,
    prefers_cashback: 7.0,
    prefers_points: 6.5,
    prefers_low_fee: 7.0,
    travel_domestic: 6.5,
    travel_international: 6.0,
    values_lounge: 6.0,
    low_score_friendly: 5.0,
    no_income_proof: 6.0,
    beginner_friendly: 5.0,
    digital_first: 9.0,
    traditional_bank: 2.0,
    international_purchase: 6.5,
    spread_rate_quality: 8.0,
    insurance_coverage: 7.0,
    additional_cards: 6.0,
  },
  'c6-mastercard-platinum': {
    income_level: 3.0,
    monthly_spending: 3.0,
    investment_level: 2.0,
    prefers_miles: 3.0,
    prefers_cashback: 5.0,
    prefers_points: 4.0,
    prefers_low_fee: 10.0, // Sem anuidade
    travel_domestic: 3.0,
    travel_international: 2.0,
    values_lounge: 1.0,
    low_score_friendly: 8.0, // Mais fácil aprovação
    no_income_proof: 8.0,
    beginner_friendly: 9.0,
    digital_first: 9.0,
    traditional_bank: 2.0,
    international_purchase: 4.0,
    spread_rate_quality: 8.0,
    insurance_coverage: 4.0,
    additional_cards: 5.5,
  },
}

export async function seedCardScores() {
  console.log('📊 Seeding card criterion scores...')

  const criteria = await prisma.criterion.findMany()
  const criteriaMap: Record<string, number> = {}
  for (const c of criteria) {
    criteriaMap[c.key] = c.id
  }

  let count = 0

  for (const [slug, scores] of Object.entries(cardScores)) {
    const card = await prisma.card.findUnique({ where: { slug } })
    if (!card) {
      console.warn(`   ⚠️ Card slug "${slug}" não encontrado`)
      continue
    }

    // Limpar scores antigos para o cartão
    await prisma.cardCriterionScore.deleteMany({ where: { cardId: card.id } })

    for (const [cKey, score] of Object.entries(scores)) {
      const criterionId = criteriaMap[cKey]
      if (!criterionId) continue

      await prisma.cardCriterionScore.create({
        data: {
          cardId: card.id,
          criterionId,
          score,
        },
      })
      count++
    }
  }

  console.log(`   ✅ ${count} card criterion scores inseridos`)
}
