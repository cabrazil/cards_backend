import 'dotenv/config'
import { extractCardInfo } from '../services/cardExtractor'
import { saveExtractedCardToDb } from '../services/cardPersistence'

const sampleTextTheOne = `
O Itaú Personnalité The One Mastercard Black é o cartão mais exclusivo do Itaú Personnalité.
- Anuidade: R$ 4.000,00 por ano (12x de R$ 333,33).
- Regras de isenção de anuidade:
  * Isenção de 100% da anuidade para faturas a partir de R$ 60.000,00 no mês.
  * Desconto de 50% na anuidade para faturas entre R$ 30.000,00 e R$ 59.999,00.
  * Isenção total para quem possui a partir de R$ 5 milhões investidos no Itaú Personnalité.
  * Isenção pelo programa Minhas Vantagens (Nível 5).
  * Permite solicitar até 6 cartões adicionais gratuitos.
- Pontuação e Programa de Pontos:
  * 3,0 pontos por dólar gasto em compras nacionais.
  * 3,5 pontos por dólar gasto em compras internacionais.
  * Os pontos nunca expiram.
- Acesso a Salas VIP:
  * LoungeKey: Acesso gratuito e ilimitado para o titular e cartões adicionais a mais de 1.100 salas VIP no mundo.
  * Oferece 12 convidados gratuitos por ano pelo LoungeKey.
  * Salas VIP Mastercard Black no Terminal 3 do Aeroporto de Guarulhos (GRU) gratuitas e ilimitadas.
- Benefícios exclusivos:
  * Concierge The Assistant 24h para reservas de alta gastronomia e viagens.
  * Parceria exclusiva Fasano (benefícios em hotéis e restaurantes).
  * Todos os seguros da bandeira Mastercard Black (médico internacional de até US$ 175 mil, proteção de compra, bagagem).
- Emissor: Itaú Personnalité
- Bandeira: Mastercard Black
`

async function run() {
  console.log('🚀 Iniciando teste de extração via OpenRouter...')
  console.log('📄 Processando: Itaú Personnalité The One Mastercard Black\n')

  try {
    const data = await extractCardInfo(sampleTextTheOne, 'google/gemini-2.5-flash')
    console.log('✅ EXTRAÇÃO CONCLUÍDA COM SUCESSO!\n')
    console.log('--- OBJETO COMPLETO EXTRAÍDO ---')
    console.log(JSON.stringify(data, null, 2))

    console.log('\n💾 Salvando cartão no PostgreSQL da VPS via Prisma...')
    const saved = await saveExtractedCardToDb(data)
    console.log(`🎉 CARTÃO ${saved.isUpdate ? 'ATUALIZADO' : 'CADASTRADO'} COM SUCESSO! ID: ${saved.card.id}, Nome: ${saved.card.name}`)
  } catch (err: any) {
    console.error('❌ Erro:', err.message || err)
  }
}

run()
