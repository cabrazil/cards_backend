import prisma from '../lib/prisma'
import { IssuerType } from '@prisma/client'

// Classificação dos 42 issuers por tipo
const issuerTypeMap: Record<string, IssuerType> = {
  'Banco do Brasil': 'BANCO_COMERCIAL',
  'Bradesco': 'BANCO_COMERCIAL',
  'Itau': 'BANCO_COMERCIAL',
  'Santander': 'BANCO_COMERCIAL',
  'Caixa Economica Federal': 'BANCO_COMERCIAL',
  'Safra': 'BANCO_COMERCIAL',
  'Banco do Nordeste': 'BANCO_COMERCIAL',
  'Banco Votorantim': 'BANCO_COMERCIAL',
  'Daycoval': 'BANCO_COMERCIAL',
  'Banco PAN': 'BANCO_COMERCIAL',
  'Banco BMG': 'BANCO_COMERCIAL',
  'Banco BV': 'BANCO_COMERCIAL',
  'Banrisul': 'BANCO_COMERCIAL',
  'BRB': 'BANCO_COMERCIAL',
  'Banese': 'BANCO_COMERCIAL',
  'Banpara': 'BANCO_COMERCIAL',

  'Nubank': 'BANCO_DIGITAL',
  'C6 Bank': 'BANCO_DIGITAL',
  'Inter': 'BANCO_DIGITAL',
  'Next': 'BANCO_DIGITAL',
  'Neon': 'BANCO_DIGITAL',
  'PicPay': 'BANCO_DIGITAL',
  'Digio': 'BANCO_DIGITAL',
  'Original': 'BANCO_DIGITAL',
  'Sofisa': 'BANCO_DIGITAL',
  'Banco Bari': 'BANCO_DIGITAL',
  'RappiBank': 'BANCO_DIGITAL',

  'XP Investimentos': 'BANCO_INVESTIMENTOS',
  'BTG Pactual': 'BANCO_INVESTIMENTOS',
  'Agora Investimentos': 'BANCO_INVESTIMENTOS',
  'Genial Investimentos': 'BANCO_INVESTIMENTOS',
  'Modalmais': 'BANCO_INVESTIMENTOS',
  'Rico': 'BANCO_INVESTIMENTOS',
  'Gradual': 'BANCO_INVESTIMENTOS',

  'Sicoob': 'COOPERATIVA',
  'Sicredi': 'COOPERATIVA',
  'Unicred': 'COOPERATIVA',
  'Uniprime': 'COOPERATIVA',
  'Cresol': 'COOPERATIVA',

  'Credicard': 'FINTECH',
  'Porto Seguro': 'OUTRO',
}

export async function seedIssuers() {
  console.log('🏦 Seeding issuers...')

  const issuers = Object.entries(issuerTypeMap)

  for (const [name, type] of issuers) {
    await prisma.issuer.upsert({
      where: { name },
      update: { type },
      create: { name, type },
    })
  }

  const count = await prisma.issuer.count()
  console.log(`   ✅ ${count} issuers criados`)
}
