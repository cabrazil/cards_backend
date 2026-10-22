import prisma from '../lib/prisma'

export async function seedDefaultScores() {
  console.log('📊 Generando scores padrão para todos os cartões cadastrados...')

  const criteria = await prisma.criterion.findMany()
  const criteriaMap: Record<string, number> = {}
  for (const c of criteria) {
    criteriaMap[c.key] = c.id
  }

  const cards = await prisma.card.findMany({
    include: { criterionScores: true }
  })

  let count = 0

  for (const card of cards) {
    // Se o cartão já tem scores completos (ex: os 5 que cadastramos manualmente), pulamos
    if (card.criterionScores.length >= 10) {
      continue
    }

    // Excluir scores parciais para evitar duplicações
    await prisma.cardCriterionScore.deleteMany({ where: { cardId: card.id } })

    const categoryLower = card.category.toLowerCase()
    const nameLower = card.name.toLowerCase()

    // Definir scores baseados no perfil e categoria do cartão
    const scores: Record<string, number> = {
      income_level: 2.0,
      monthly_spending: 2.0,
      investment_level: 1.0,
      prefers_miles: 2.0,
      prefers_cashback: 4.0,
      prefers_points: 2.0,
      prefers_low_fee: 9.0, // Alta pontuação para anuidade baixa
      travel_domestic: 2.0,
      travel_international: 1.0,
      values_lounge: 0.0,
      low_score_friendly: 8.0,
      no_income_proof: 8.0,
      beginner_friendly: 9.0,
      digital_first: 7.0,
      traditional_bank: 3.0,
      international_purchase: 4.0,
      spread_rate_quality: 5.0,
      insurance_coverage: 2.0,
      additional_cards: 4.0,
    }

    if (categoryLower.includes('black') || categoryLower.includes('infinite') || categoryLower.includes('nanquim') || categoryLower.includes('centurion')) {
      // Cartão Premium Alta Renda
      scores.income_level = 8.5
      scores.monthly_spending = 8.0
      scores.prefers_miles = 9.0
      scores.prefers_points = 8.5
      scores.prefers_low_fee = 3.0
      scores.travel_domestic = 8.5
      scores.travel_international = 9.0
      scores.values_lounge = 9.0
      scores.low_score_friendly = 2.0
      scores.no_income_proof = 3.0
      scores.beginner_friendly = 2.0
      scores.insurance_coverage = 9.5
      scores.additional_cards = 8.0
      scores.prefers_cashback = nameLower.includes('ultravioleta') || nameLower.includes('black') ? 7.0 : 3.0
    } else if (categoryLower.includes('platinum') || categoryLower.includes('grafite') || categoryLower.includes('signature')) {
      // Cartão Intermediário
      scores.income_level = 5.0
      scores.monthly_spending = 5.0
      scores.prefers_miles = 5.5
      scores.prefers_points = 5.0
      scores.prefers_low_fee = 6.5
      scores.travel_domestic = 5.0
      scores.travel_international = 4.0
      scores.values_lounge = 2.0
      scores.low_score_friendly = 5.0
      scores.no_income_proof = 6.0
      scores.beginner_friendly = 5.0
      scores.insurance_coverage = 6.0
      scores.additional_cards = 6.0
      scores.prefers_cashback = 5.0
    } else if (categoryLower.includes('gold')) {
      // Cartão de Entrada com benefícios básicos
      scores.income_level = 3.0
      scores.monthly_spending = 3.0
      scores.prefers_miles = 3.0
      scores.prefers_points = 3.0
      scores.prefers_low_fee = 8.0
      scores.travel_domestic = 3.0
      scores.travel_international = 2.0
      scores.values_lounge = 1.0
      scores.low_score_friendly = 7.0
      scores.no_income_proof = 7.0
      scores.beginner_friendly = 8.0
      scores.insurance_coverage = 4.0
      scores.additional_cards = 5.0
      scores.prefers_cashback = 4.0
    }

    // Ajustes específicos por nome do emissor/banco
    if (nameLower.includes('inter') || nameLower.includes('c6') || nameLower.includes('nubank') || nameLower.includes('neon')) {
      scores.digital_first = 9.5
      scores.traditional_bank = 1.0
    } else if (nameLower.includes('bradesco') || nameLower.includes('itau') || nameLower.includes('santander') || nameLower.includes('brasil')) {
      scores.digital_first = 2.0
      scores.traditional_bank = 9.0
    }

    // Gravar os scores de critério para o cartão
    for (const [cKey, val] of Object.entries(scores)) {
      const criterionId = criteriaMap[cKey]
      if (criterionId) {
        await prisma.cardCriterionScore.create({
          data: {
            cardId: card.id,
            criterionId,
            score: val,
          }
        })
        count++
      }
    }
  }

  console.log(`   ✅ ${count} scores de critérios atribuídos aos novos cartões!`)
}

if (require.main === module) {
  seedDefaultScores()
}
