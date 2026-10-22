import prisma from '../lib/prisma'
import { QuestionType } from '@prisma/client'

export async function seedOnboarding() {
  console.log('❓ Seeding onboarding sections & questions...')

  // Limpar tabelas de onboarding anteriores para evitar conflitos de IDs e FKs
  await prisma.optionCriterionWeight.deleteMany({})
  await prisma.questionOption.deleteMany({})
  await prisma.onboardingQuestion.deleteMany({})
  await prisma.onboardingSection.deleteMany({})

  // === SEÇÕES ===
  const sections = [
    { key: 'goals', title: 'Objetivos', description: 'O que você busca', displayOrder: 1, iconName: 'target' },
    { key: 'profile', title: 'Perfil', description: 'Sobre sua situação profissional e de crédito', displayOrder: 2, iconName: 'user' },
    { key: 'spending', title: 'Gastos e Preferências', description: 'Hábitos financeiros', displayOrder: 3, iconName: 'wallet' },
  ]

  const sectionMap: Record<string, number> = {}
  for (const section of sections) {
    const created = await prisma.onboardingSection.create({
      data: { ...section, isActive: true },
    })
    sectionMap[section.key] = created.id
  }

  // Obter critérios para mapeamento
  const allCriteria = await prisma.criterion.findMany()
  const criteriaMap: Record<string, number> = {}
  for (const c of allCriteria) {
    criteriaMap[c.key] = c.id
  }

  // === PERGUNTAS E OPÇÕES ===
  
  // 1. Tela 1: Objetivo Principal
  const qMainGoal = await prisma.onboardingQuestion.create({
    data: {
      key: 'main_goal',
      text: 'O que você procura no seu próximo cartão?',
      helpText: 'Isso define a direção das nossas recomendações',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 1,
      sectionId: sectionMap['goals'],
      isActive: true,
      isRequired: true,
    }
  })

  const optMainGoalData = [
    { text: 'Economizar com cashback', value: 'cashback', displayOrder: 1, weights: { prefers_cashback: 10 } },
    { text: 'Acumular milhas', value: 'miles', displayOrder: 2, weights: { prefers_miles: 10, values_lounge: 5 } },
    { text: 'Conseguir meu primeiro cartão', value: 'first_card', displayOrder: 3, weights: { beginner_friendly: 10, prefers_low_fee: 5 } },
    { text: 'Aumentar meu limite', value: 'higher_limit', displayOrder: 4, weights: { monthly_spending: 5 } },
    { text: 'Ter mais benefícios', value: 'benefits', displayOrder: 5, weights: { insurance_coverage: 8, values_lounge: 7 } },
    { text: 'Ainda não sei', value: 'not_sure', displayOrder: 6, weights: { prefers_low_fee: 5, beginner_friendly: 5 } },
  ]

  const optMainGoalMap: Record<string, number> = {}
  for (const opt of optMainGoalData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qMainGoal.id,
        isActive: true,
      }
    })
    optMainGoalMap[opt.value] = created.id

    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  // 2. Tela 2 (Condicionais)
  
  // A: Se escolheu Primeiro Cartão
  const qHasCreditCard = await prisma.onboardingQuestion.create({
    data: {
      key: 'has_credit_card',
      text: 'Você já possui cartão de crédito?',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 2,
      sectionId: sectionMap['goals'],
      isActive: true,
      isRequired: true,
      showWhenQuestionId: qMainGoal.id,
      showWhenOptionId: optMainGoalMap['first_card'],
    }
  })

  const optHasCreditCardData = [
    { text: 'Não', value: 'no', displayOrder: 1, weights: { beginner_friendly: 10, low_score_friendly: 5 } },
    { text: 'Sim, mas quero outro', value: 'yes', displayOrder: 2, weights: { beginner_friendly: 5 } },
  ]

  for (const opt of optHasCreditCardData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qHasCreditCard.id,
        isActive: true,
      }
    })
    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  // B: Se escolheu Cashback
  const qCashbackSpending = await prisma.onboardingQuestion.create({
    data: {
      key: 'cashback_spending',
      text: 'Quanto você costuma gastar por mês?',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 3,
      sectionId: sectionMap['goals'],
      isActive: true,
      isRequired: true,
      showWhenQuestionId: qMainGoal.id,
      showWhenOptionId: optMainGoalMap['cashback'],
    }
  })

  const optCashbackSpendingData = [
    { text: 'Até R$ 2.000', value: 'under-2k', displayOrder: 1, weights: { prefers_low_fee: 8 } },
    { text: 'Acima de R$ 2.000', value: 'over-2k', displayOrder: 2, weights: { prefers_cashback: 8 } },
  ]

  for (const opt of optCashbackSpendingData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qCashbackSpending.id,
        isActive: true,
      }
    })
    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  // 3. Tela 3: Situação profissional (Ocupação)
  const qOccupation = await prisma.onboardingQuestion.create({
    data: {
      key: 'occupation',
      text: 'Qual melhor descreve sua situação hoje?',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 4,
      sectionId: sectionMap['profile'],
      isActive: true,
      isRequired: true,
    }
  })

  const optOccupationData = [
    { text: 'CLT / Servidor', value: 'clt', displayOrder: 1, weights: { income_level: 5, traditional_bank: 3 } },
    { text: 'Autônomo / Freelancer', value: 'autonomo', displayOrder: 2, weights: { no_income_proof: 7, digital_first: 5 } },
    { text: 'MEI / Empresário', value: 'mei', displayOrder: 3, weights: { no_income_proof: 5, digital_first: 4 } },
    { text: 'Estudante', value: 'student', displayOrder: 4, weights: { beginner_friendly: 8, prefers_low_fee: 8, low_score_friendly: 5 } },
    { text: 'Aposentado', value: 'retired', displayOrder: 5, weights: { traditional_bank: 5, income_level: 4 } },
    { text: 'Em transição profissional', value: 'transition', displayOrder: 6, weights: { low_score_friendly: 8, prefers_low_fee: 10, beginner_friendly: 6 } },
  ]

  for (const opt of optOccupationData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qOccupation.id,
        isActive: true,
      }
    })
    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  // 4. Tela 4: Situação de crédito
  const qCreditStatus = await prisma.onboardingQuestion.create({
    data: {
      key: 'credit_status',
      text: 'Como está sua situação de crédito?',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 5,
      sectionId: sectionMap['profile'],
      isActive: true,
      isRequired: true,
    }
  })

  const optCreditStatusData = [
    { text: 'Nome limpo', value: 'clean_name', displayOrder: 1, weights: { income_level: 3 } },
    { text: 'Score baixo', value: 'low_score', displayOrder: 2, weights: { low_score_friendly: 7, prefers_low_fee: 5 } },
    { text: 'Estou reorganizando minha vida financeira', value: 'reorganizing', displayOrder: 3, weights: { low_score_friendly: 10, prefers_low_fee: 8 } },
    { text: 'Prefiro não informar', value: 'prefer_not_to_say', displayOrder: 4, weights: { low_score_friendly: 5 } },
  ]

  for (const opt of optCreditStatusData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qCreditStatus.id,
        isActive: true,
      }
    })
    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  // 5. Tela 5: Gastos mensais gerais
  const qMonthlySpending = await prisma.onboardingQuestion.create({
    data: {
      key: 'monthly_spending',
      text: 'Quanto você costuma gastar no cartão por mês?',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 6,
      sectionId: sectionMap['spending'],
      isActive: true,
      isRequired: true,
    }
  })

  const optMonthlySpendingData = [
    { text: 'Até R$ 1.000', value: '0-1000', displayOrder: 1, weights: { monthly_spending: 1, prefers_low_fee: 5 } },
    { text: 'R$ 1.000 a R$ 3.000', value: '1000-3000', displayOrder: 2, weights: { monthly_spending: 3, prefers_cashback: 3 } },
    { text: 'R$ 3.000 a R$ 5.000', value: '3000-5000', displayOrder: 3, weights: { monthly_spending: 5, prefers_cashback: 5, prefers_points: 4 } },
    { text: 'R$ 5.000 a R$ 10.000', value: '5000-10000', displayOrder: 4, weights: { monthly_spending: 7, prefers_miles: 5, prefers_points: 6 } },
    { text: 'Acima de R$ 10.000', value: '10000+', displayOrder: 5, weights: { monthly_spending: 10, prefers_miles: 7, prefers_points: 8 } },
  ]

  for (const opt of optMonthlySpendingData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qMonthlySpending.id,
        isActive: true,
      }
    })
    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  // 6. Tela 6: Aceita pagar anuidade
  const qAcceptsAnnualFee = await prisma.onboardingQuestion.create({
    data: {
      key: 'accepts_annual_fee',
      text: 'Você aceita pagar anuidade?',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 7,
      sectionId: sectionMap['spending'],
      isActive: true,
      isRequired: true,
    }
  })

  const optAcceptsAnnualFeeData = [
    { text: 'Não', value: 'no', displayOrder: 1, weights: { prefers_low_fee: 10 } },
    { text: 'Depende dos benefícios', value: 'depends', displayOrder: 2, weights: { prefers_low_fee: 3, insurance_coverage: 5, values_lounge: 5 } },
    { text: 'Sim', value: 'yes', displayOrder: 3, weights: { prefers_low_fee: 0, insurance_coverage: 8, values_lounge: 8 } },
  ]

  for (const opt of optAcceptsAnnualFeeData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qAcceptsAnnualFee.id,
        isActive: true,
      }
    })
    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  // 7. Tela 7: Hábitos de viagem
  const qTravelFrequency = await prisma.onboardingQuestion.create({
    data: {
      key: 'travel_frequency',
      text: 'Você costuma viajar?',
      type: QuestionType.SINGLE_CHOICE,
      displayOrder: 8,
      sectionId: sectionMap['spending'],
      isActive: true,
      isRequired: true,
    }
  })

  const optTravelFrequencyData = [
    { text: 'Nunca', value: 'never', displayOrder: 1, weights: { travel_domestic: 0, travel_international: 0 } },
    { text: 'Às vezes', value: 'sometimes', displayOrder: 2, weights: { travel_domestic: 5, travel_international: 3, prefers_miles: 3 } },
    { text: 'Frequentemente', value: 'frequently', displayOrder: 3, weights: { travel_domestic: 10, travel_international: 10, prefers_miles: 10, values_lounge: 8 } },
  ]

  for (const opt of optTravelFrequencyData) {
    const created = await prisma.questionOption.create({
      data: {
        text: opt.text,
        value: opt.value,
        displayOrder: opt.displayOrder,
        questionId: qTravelFrequency.id,
        isActive: true,
      }
    })
    for (const [cKey, weight] of Object.entries(opt.weights)) {
      const cId = criteriaMap[cKey]
      if (cId) {
        await prisma.optionCriterionWeight.create({
          data: { optionId: created.id, criterionId: cId, weight }
        })
      }
    }
  }

  const questionCount = await prisma.onboardingQuestion.count()
  console.log(`   ✅ Onboarding simplificado configurado: ${questionCount} perguntas criadas`)
}
