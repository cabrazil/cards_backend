import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

interface SimulatedAnswer {
  questionId: number
  optionId: number
}

export async function recommendationRoutes(app: FastifyInstance) {
  // 1. Obter perguntas e opções do onboarding
  app.get('/onboarding/questions', async () => {
    const sections = await prisma.onboardingSection.findMany({
      where: { isActive: true },
      include: {
        questions: {
          where: { isActive: true },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return sections
  })

  // 2. Simular recomendação (sem precisar salvar no banco, ideal para testes)
  app.post<{
    Body: {
      answers: SimulatedAnswer[]
    }
  }>('/recommendations/simulate', async (request, reply) => {
    const { answers } = request.body

    if (!Array.isArray(answers) || answers.length === 0) {
      reply.code(400)
      return { error: 'As respostas (answers) são obrigatórias.' }
    }

    // 1. Carregar todos os pesos das opções de resposta escolhidas
    const optionIds = answers.map((a) => a.optionId)
    const optionWeights = await prisma.optionCriterionWeight.findMany({
      where: { optionId: { in: optionIds } },
      include: { criterion: true },
    })

    // 2. Calcular o vetor de perfil do usuário (soma dos pesos por critério)
    const userProfileWeights: Record<string, { id: number; weight: number }> = {}
    for (const ow of optionWeights) {
      const key = ow.criterion.key
      const weightVal = Number(ow.weight)

      if (!userProfileWeights[key]) {
        userProfileWeights[key] = { id: ow.criterionId, weight: 0 }
      }
      userProfileWeights[key].weight += weightVal
    }

    // 3. Buscar detalhes das opções escolhidas para identificar restrições explícitas (anuidade e gastos)
    const selectedOptions = await prisma.questionOption.findMany({
      where: { id: { in: optionIds } },
      include: { question: true },
    })

    const feeOption = selectedOptions.find((o) => o.question.key === 'accepts_annual_fee')
    const userRefusesFee = feeOption?.value === 'no'

    const spendingOption = selectedOptions.find((o) => o.question.key === 'monthly_spending')
    let userSpendEstimate = 5000 // default R$ 5.000
    if (spendingOption?.value === '0-1000') userSpendEstimate = 1000
    else if (spendingOption?.value === '1000-3000') userSpendEstimate = 3000
    else if (spendingOption?.value === '3000-5000') userSpendEstimate = 5000
    else if (spendingOption?.value === '5000-10000') userSpendEstimate = 10000
    else if (spendingOption?.value === '10000+') userSpendEstimate = 20000

    // Extrair preferências da primeira página (Objetivo Principal e Condicionais)
    const mainGoal = selectedOptions.find((o) => o.question.key === 'main_goal')?.value
    const hasCard = selectedOptions.find((o) => o.question.key === 'has_credit_card')?.value
    const cashbackSpending = selectedOptions.find((o) => o.question.key === 'cashback_spending')?.value

    // 4. Buscar todos os cartões ativos com relacionamentos
    const cards = await prisma.card.findMany({
      where: { status: 'ACTIVE' },
      include: {
        issuer: { select: { name: true, logoUrl: true } },
        brand: { select: { name: true, variant: true } },
        criterionScores: { include: { criterion: true } },
        zeroFees: true,
      },
    })

    // Função auxiliar para extrair meta de gastos da regra de isenção
    const parseSpendFromExpenses = (text?: string | null): number | null => {
      if (!text) return null
      const clean = text.replace(/\./g, '')
      const match = clean.match(/(?:r\$|fatura[s]?\s*(?:a\s*partir\s*de|de|acima\s*de)?)\s*(\d+)/i)
      if (match && match[1]) {
        const val = parseInt(match[1], 10)
        return !isNaN(val) && val > 0 ? val : null
      }
      const milMatch = clean.match(/(\d+)\s*mil/i)
      if (milMatch && milMatch[1]) {
        return parseInt(milMatch[1], 10) * 1000
      }
      return null
    }

    // 5. Calcular compatibilidade para cada cartão com restrições de negócio
    const recommendations = cards
      .map((card: any) => {
        let actualScoreSum = 0
        let maxPossibleScoreSum = 0

        // Comparar o score do cartão com o peso do usuário para cada critério
        for (const [key, userPref] of Object.entries(userProfileWeights)) {
          if (userPref.weight <= 0) continue

          const cardScoreRecord = card.criterionScores.find(
            (cs: any) => cs.criterionId === userPref.id
          )
          const cardScore = cardScoreRecord ? Number(cardScoreRecord.score) : 0

          actualScoreSum += cardScore * userPref.weight
          maxPossibleScoreSum += 10 * userPref.weight
        }

        const rawPercentage = maxPossibleScoreSum > 0 
          ? (actualScoreSum / maxPossibleScoreSum) * 100 
          : 0

        let compatScore = Math.max(0, Math.min(100, Math.round(rawPercentage * 100) / 100))

        const annualFee = Number(card.annualFee) || 0
        let feePenalty = 0
        let feeBonusReason: string | null = null

        // 6. Regra de Negócio: Restrição de Anuidade
        if (userRefusesFee) {
          if (annualFee === 0) {
            feeBonusReason = 'Sem anuidade: cartão 100% gratuito sem pegadinhas.'
          } else {
            // Verificar se o usuário consegue isentar 100% com seus gastos
            let minSpendForFree: number | null = null
            for (const zf of (card.zeroFees || [])) {
              if (zf.feeDiscount >= 100) {
                const spend = parseSpendFromExpenses(zf.expenses)
                if (spend !== null) {
                  if (minSpendForFree === null || spend < minSpendForFree) {
                    minSpendForFree = spend
                  }
                }
              }
            }

            if (minSpendForFree !== null && userSpendEstimate >= minSpendForFree) {
              feeBonusReason = `Anuidade de R$ ${annualFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, mas você zera 100% com seu gasto mensal!`
            } else {
              // Não atinge a isenção de gastos -> penalizar severamente
              feePenalty = 50
            }
          }
        }

        // Aplicar penalidade se houver conflito com anuidade
        if (feePenalty > 0) {
          compatScore = Math.max(5, compatScore - feePenalty)
        }

        // 7. Gerar motivos dinâmicos da recomendação
        const reasons: string[] = []

        // A) Motivo #1 prioritário: Resposta direta ao objetivo da primeira página do quiz
        if (mainGoal === 'higher_limit') {
          const spendingScore = Number(card.criterionScores.find((cs: any) => cs.criterion.key === 'monthly_spending')?.score || 0)
          const isHighEnd = card.segment === 'ALTA_RENDA' || card.category === 'BLACK' || card.category === 'INFINITE'

          if (isHighEnd || spendingScore >= 8) {
            reasons.push('Excelente potencial para concessão de limites elevados e faturas altas.')
          } else if (spendingScore >= 6) {
            reasons.push('Favorece maior poder de compra e expansão de limite para sua rotina.')
          } else {
            reasons.push('Permite aumento progressivo de limite com base no uso da conta e pontualidade.')
          }
        } else if (mainGoal === 'miles') {
          const milesScore = Number(card.criterionScores.find((cs: any) => cs.criterion.key === 'prefers_miles')?.score || 0)
          const loungeScore = Number(card.criterionScores.find((cs: any) => cs.criterion.key === 'values_lounge')?.score || 0)

          if (milesScore >= 7) {
            reasons.push('Excelente acúmulo de milhas e transferência para as principais companhias aéreas.')
          } else if (loungeScore >= 7) {
            reasons.push('Acesso exclusivo a Salas VIP e comodidades de viagem para quem voa com frequência.')
          } else {
            reasons.push('Pontuação diferenciada para acelerar o resgate de passagens e viagens.')
          }
        } else if (mainGoal === 'cashback') {
          const cashbackScore = Number(card.criterionScores.find((cs: any) => cs.criterion.key === 'prefers_cashback')?.score || 0)

          if (cashbackSpending === 'over-2k' || cashbackScore >= 7) {
            reasons.push('Retorno de dinheiro (cashback) direto na sua conta ou abatido na fatura.')
          } else if (cashbackSpending === 'under-2k' && annualFee === 0) {
            reasons.push('Cashback garantido mesmo com faturas menores, 100% livre de anuidade.')
          } else {
            reasons.push('Economia real com programa de cashback em compras do dia a dia.')
          }
        } else if (mainGoal === 'first_card') {
          if (hasCard === 'no') {
            reasons.push('Ideal para o primeiro cartão: aprovação simplificada e gestão descomplicada no app.')
          } else if (hasCard === 'yes') {
            reasons.push('Excelente para substituir seu cartão atual e acelerar seu histórico de crédito.')
          } else {
            reasons.push('Aprovação acessível e ótima usabilidade para começar com o pé direito.')
          }
        } else if (mainGoal === 'benefits') {
          const insuranceScore = Number(card.criterionScores.find((cs: any) => cs.criterion.key === 'insurance_coverage')?.score || 0)
          const loungeScore = Number(card.criterionScores.find((cs: any) => cs.criterion.key === 'values_lounge')?.score || 0)

          if (loungeScore >= 7) {
            reasons.push('Acesso exclusivo a Salas VIP e concierge 24h para experiências diferenciadas.')
          } else if (insuranceScore >= 7) {
            reasons.push('Pacote completo de proteções: seguro viagem, garantia estendida e compra protegida.')
          } else {
            reasons.push('Benefícios exclusivos da bandeira, tags de pedágio e descontos em parceiros.')
          }
        } else if (mainGoal === 'not_sure') {
          if (annualFee === 0) {
            reasons.push('Cartão versátil e sem anuidade, equilibrando praticidade e economia no dia a dia.')
          } else {
            reasons.push('Ótimo equilíbrio entre facilidade de aprovação e benefícios versáteis.')
          }
        }

        // B) Motivo de Anuidade / Isenção (se aplicável e ainda não redundante)
        if (feeBonusReason && !reasons.includes(feeBonusReason)) {
          reasons.push(feeBonusReason)
        }

        if (feePenalty > 0) {
          reasons.push(`Atenção: exige gastos muito acima de R$ ${userSpendEstimate.toLocaleString('pt-BR')} para isentar anuidade.`)
        }

        // C) Complementos relevantes baseados nos scores do cartão (sem duplicar temas)
        for (const cs of card.criterionScores) {
          if (reasons.length >= 3) break

          const key = cs.criterion.key
          const cardScore = Number(cs.score)
          const userPref = userProfileWeights[key]

          if (userPref && userPref.weight > 5 && cardScore >= 7) {
            let reasonText = ''
            if (key === 'prefers_miles' && mainGoal !== 'miles') {
              reasonText = 'Excelente acúmulo de milhas e parcerias aéreas.'
            } else if (key === 'prefers_cashback' && mainGoal !== 'cashback') {
              reasonText = 'Retorno de dinheiro (cashback) direto na sua conta ou fatura.'
            } else if (key === 'prefers_low_fee' && !feeBonusReason && annualFee === 0) {
              reasonText = 'Anuidade gratuita sem pegadinhas ou exigências.'
            } else if (key === 'low_score_friendly') {
              reasonText = 'Fácil aprovação para quem está construindo score ou reorganizando finanças.'
            } else if (key === 'values_lounge' && mainGoal !== 'miles' && mainGoal !== 'benefits') {
              reasonText = 'Excelente acesso gratuito a Salas VIP em aeroportos.'
            } else if (key === 'no_income_proof') {
              reasonText = 'Sem burocracia, não exige comprovante formal de renda.'
            } else if (key === 'beginner_friendly' && mainGoal !== 'first_card') {
              reasonText = 'Prático e amigável para o dia a dia.'
            } else if (key === 'monthly_spending' && mainGoal !== 'higher_limit') {
              reasonText = 'Excelente suporte a volumes maiores de compras e limites flexíveis.'
            }

            if (reasonText && !reasons.includes(reasonText)) {
              reasons.push(reasonText)
            }
          }
        }

        if (reasons.length === 0) {
          if (compatScore >= 80) {
            reasons.push('Alta compatibilidade com a sua renda e preferências indicadas.')
          } else {
            reasons.push('Atende aos requisitos básicos declarados no seu perfil.')
          }
        }

        return {
          id: card.id,
          name: card.name,
          slug: card.slug,
          annualFee,
          category: card.category,
          pictureUrl: card.pictureUrl,
          issuer: card.issuer.name,
          brand: `${card.brand.name} ${card.brand.variant}`,
          compatScore,
          reasons: reasons.slice(0, 3),
        }
      })
      .filter((rec: any) => rec.compatScore > 0)
      .sort((a: any, b: any) => b.compatScore - a.compatScore)

    return {
      profileSnapshot: userProfileWeights,
      recommendations: recommendations.slice(0, 5),
    }
  })
}
