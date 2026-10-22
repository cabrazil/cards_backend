import prisma from '../lib/prisma'

const criteria = [
  // Perfil financeiro
  { key: 'income_level', label: 'Nível de renda', description: 'Quanto maior a renda, maior a compatibilidade com cartões premium' },
  { key: 'monthly_spending', label: 'Volume de gastos mensais', description: 'Gastos mensais influenciam benefícios de pontuação e cashback' },
  { key: 'investment_level', label: 'Nível de investimentos', description: 'Investimentos podem isentar anuidade e desbloquear cartões exclusivos' },

  // Preferências de benefícios
  { key: 'prefers_miles', label: 'Preferência por milhas', description: 'Usuário valoriza acúmulo de milhas aéreas' },
  { key: 'prefers_cashback', label: 'Preferência por cashback', description: 'Usuário valoriza retorno em dinheiro' },
  { key: 'prefers_points', label: 'Preferência por pontos', description: 'Usuário valoriza programa de pontos flexível' },
  { key: 'prefers_low_fee', label: 'Sensibilidade à anuidade', description: 'Usuário prioriza anuidade baixa ou zero' },

  // Viagens
  { key: 'travel_domestic', label: 'Viagens domésticas', description: 'Frequência de viagens dentro do Brasil' },
  { key: 'travel_international', label: 'Viagens internacionais', description: 'Frequência de viagens ao exterior' },
  { key: 'values_lounge', label: 'Valoriza sala VIP', description: 'Importância de acesso a lounges em aeroportos' },

  // Acessibilidade
  { key: 'low_score_friendly', label: 'Acessível para score baixo', description: 'Cartão acessível para pessoas com score de crédito baixo' },
  { key: 'no_income_proof', label: 'Sem comprovação de renda', description: 'Não exige comprovação formal de renda' },
  { key: 'beginner_friendly', label: 'Amigável para iniciantes', description: 'Adequado para quem está começando no mundo dos cartões' },

  // Digital
  { key: 'digital_first', label: 'Banco digital', description: 'Preferência por bancos 100% digitais' },
  { key: 'traditional_bank', label: 'Banco tradicional', description: 'Preferência por bancos com agência física' },

  // Funcionalidades
  { key: 'international_purchase', label: 'Compras internacionais', description: 'Frequência de compras em moeda estrangeira' },
  { key: 'spread_rate_quality', label: 'Qualidade do spread cambial', description: 'Spread competitivo para compras internacionais' },
  { key: 'insurance_coverage', label: 'Cobertura de seguros', description: 'Importância dos seguros incluídos (viagem, compras, auto)' },
  { key: 'additional_cards', label: 'Cartões adicionais', description: 'Necessidade de cartões adicionais para família' },
]

export async function seedCriteria() {
  console.log('📊 Seeding criteria...')

  for (const criterion of criteria) {
    await prisma.criterion.upsert({
      where: { key: criterion.key },
      update: {
        label: criterion.label,
        description: criterion.description,
      },
      create: {
        ...criterion,
        maxScore: 10,
        isActive: true,
      },
    })
  }

  const count = await prisma.criterion.count()
  console.log(`   ✅ ${count} critérios criados`)
}
