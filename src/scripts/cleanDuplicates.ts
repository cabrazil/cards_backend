import prisma from '../lib/prisma'

async function main() {
  console.log('--- Analisando Duplicidades na Base de Cartões ---')

  const duplicatesToResolve = [
    {
      keepId: 55, // Nubank Ultravioleta Mastercard Black (mais recente e completo)
      removeId: 17, // Nubank Mastercard Black Ultravioleta
      name: 'Nubank Ultravioleta',
    },
    {
      keepId: 56, // XP One Visa Infinite (mais recente)
      removeId: 19, // XP Visa Infinite One
      name: 'XP One Visa Infinite',
    },
    {
      keepId: 21, // Porto Bank Mastercard Black (nome correto do banco com espaço)
      removeId: 2, // PortoBank Mastercard Black
      name: 'Porto Bank Mastercard Black',
    },
    {
      keepId: 24, // C6 Carbon Mastercard Black (especificação Black completa)
      removeId: 3, // C6 Carbon Mastercard
      name: 'C6 Carbon Mastercard Black',
    },
  ]

  for (const item of duplicatesToResolve) {
    const keepCard = await prisma.card.findUnique({ where: { id: item.keepId } })
    const removeCard = await prisma.card.findUnique({ where: { id: item.removeId } })

    if (!removeCard) {
      console.log(`[OK] Cartão duplicado ID ${item.removeId} já não existe.`)
      continue
    }

    if (!keepCard) {
      console.log(`[AVISO] Cartão de destino ID ${item.keepId} não encontrado.`)
      continue
    }

    console.log(`\nMesclando "${item.name}":`)
    console.log(`  -> Manter: ID ${keepCard.id} ("${keepCard.name}")`)
    console.log(`  -> Remover: ID ${removeCard.id} ("${removeCard.name}")`)

    // 1. Re-apontar recomendações e favoritos se existirem
    await prisma.recommendationCard.updateMany({
      where: { cardId: removeCard.id },
      data: { cardId: keepCard.id },
    })

    // 2. Remover favoritos que causariam conflito de chave única
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

    // 3. Deletar dependências filhas do cartão duplicado (Cascade já está no schema, mas garantindo)
    await prisma.cardCriterionScore.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.zeroFee.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.reward.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.lounge.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.cardWallet.deleteMany({ where: { cardId: removeCard.id } })
    await prisma.cardTag.deleteMany({ where: { cardId: removeCard.id } })

    // 4. Deletar o cartão duplicado
    await prisma.card.delete({ where: { id: removeCard.id } })

    console.log(`  [SUCESSO] ID ${removeCard.id} removido e unificado no ID ${keepCard.id}!`)
  }

  const remainingCount = await prisma.card.count()
  console.log(`\nBase limpa com sucesso! Total de cartões restantes: ${remainingCount}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Erro ao limpar duplicidades:', err)
  process.exit(1)
})
