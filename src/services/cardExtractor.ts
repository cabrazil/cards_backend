export interface ExtractedCardData {
  card: {
    name: string;
    slug: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
    segment: 'ALTA_RENDA' | 'INTERMEDIARIO' | 'ENTRADA';
    category: string;
    annualFee: number;
    spreadRate: number;
    pointsExpire: boolean;
    pointsAccelerator?: boolean;
    rankPoints: number; // 1 a 5
    rankBenefits: number; // 1 a 5
    rankAnnuity: number; // 1 a 5 (5 sendo o melhor para o cliente, ex: sem anuidade)
    rankMilesProgram: number; // 1 a 5
    rankVipLounges: number; // 1 a 5
    vipLoungeApp?: string;
    obsSummary: string[];
    issuerName: string;
    brandName: string;
    brandVariant: string;
  };
  zeroFees: Array<{
    expenses?: string;
    investments?: string;
    feeDiscount: number;
    notes?: string;
    conditions: string[];
  }>;
  rewards: Array<{
    expenses: string;
    pointsPerDollar: number;
    pointsPerReal?: number;
    rules?: string;
    expiration: boolean;
    notes?: string;
  }>;
  lounges: Array<{
    name: string;
    accessLimit: string;
    conditions?: string;
    isPaid: boolean;
  }>;
  criterionScores: Record<string, number>; // key -> score 0 a 10
}

const CRITERIA_KEYS = [
  'income_level',
  'monthly_spending',
  'investment_level',
  'prefers_miles',
  'prefers_cashback',
  'prefers_points',
  'prefers_low_fee',
  'travel_domestic',
  'travel_international',
  'values_lounge',
  'low_score_friendly',
  'no_income_proof',
  'beginner_friendly',
  'digital_first',
  'traditional_bank',
  'international_purchase',
  'spread_rate_quality',
  'insurance_coverage',
  'additional_cards'
];

export async function extractCardInfo(rawText: string, model = 'google/gemini-2.5-flash', useWebSearch = false): Promise<ExtractedCardData> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY não encontrada no arquivo .env');
  }

  const systemPrompt = `Você é um analista especialista em cartões de crédito e programas de fidelidade do Brasil.
Sua missão é ler o texto fornecido e extrair os dados técnicos do cartão em formato JSON RIGOROSO, compatível com o schema do banco de dados Prisma.

Estrutura EXATA do JSON esperado:
{
  "card": {
    "name": "Nome Completo do Cartão",
    "slug": "nome-do-cartao-em-kebab-case",
    "segment": "ALTA_RENDA" | "INTERMEDIARIO" | "ENTRADA",
    "category": "BLACK" | "INFINITE" | "PLATINUM" | "GOLD" | "STANDARD",
    "annualFee": 4000.00,
    "spreadRate": 5.5,
    "pointsExpire": false,
    "pointsAccelerator": true, // true se tiver aceleradores como Santander Rewards, Bateu Ganhou, etc.
    "rankPoints": 5, // 1 a 5
    "rankBenefits": 5, // 1 a 5
    "rankAnnuity": 1, // 1 a 5 (5 sendo o melhor para o cliente, ex: sem anuidade)
    "rankMilesProgram": 5, // 1 a 5
    "rankVipLounges": 5, // 1 a 5
    "vipLoungeApp": "LoungeKey",
    "obsSummary": ["Destaque 1", "Destaque 2"],
    "issuerName": "Santander",
    "brandName": "Visa",
    "brandVariant": "Infinite"
  },
  "zeroFees": [
    {
      "expenses": "Faturas a partir de R$ 60.000/mês",
      "investments": "A partir de R$ 5 milhões investidos",
      "feeDiscount": 100, // IMPORTANTE: número inteiro (100 para isenção total, 50 para 50%, etc.). NUNCA retorne null.
      "conditions": ["R$ 60k/mês ou R$ 5mi investidos ou Nível 5 Minhas Vantagens"]
    }
  ],
  "rewards": [
    // ATENÇÃO MÁXIMA: Crie um item no array para CADA variação de pontuação mencionada:
    // 1. Pontuação Padrão (ex: 2.6 pts/dólar)
    // 2. Clientes de Segmentos Especiais (ex: "Clientes Select: 3.6 pts/dólar", "Private: 4.0 pts/dólar")
    // 3. Aceleradores e Bônus (ex: "Com Santander Rewards: até 5.4 pts/dólar")
    // 4. Faixas de Fatura (ex: "Fatura >= R$ 4.000" vs "Fatura < R$ 4.000")
    {
      "expenses": "Padrão / Geral",
      "pointsPerDollar": 2.6,
      "rules": "2.6 pontos por dólar em compras nacionais e internacionais",
      "expiration": false,
      "notes": "Pontos nunca expiram"
    },
    {
      "expenses": "Clientes Select / Private",
      "pointsPerDollar": 3.6,
      "rules": "Até 3.6 pontos por dólar para clientes do segmento Select",
      "expiration": false,
      "notes": "Benefício exclusivo para correntistas Select"
    },
    {
      "expenses": "Com Santander Rewards (Acelerador)",
      "pointsPerDollar": 5.4,
      "rules": "Potencializa para até 5.4 pontos por dólar com o Santander Rewards",
      "expiration": false,
      "notes": "Mediante adesão ao programa de aceleração"
    }
  ],
  "lounges": [
    {
      "name": "LoungeKey / Visa Airport Companion",
      "accessLimit": "Ilimitado",
      "conditions": "Titular e adicionais ilimitados",
      "isPaid": false
    }
  ],
  "criterionScores": {
    // Nota de 0.0 a 10.0 para CADA um dos 19 critérios abaixo:
    // income_level, monthly_spending, investment_level, prefers_miles, prefers_cashback,
    // prefers_points, prefers_low_fee, travel_domestic, travel_international, values_lounge,
    // low_score_friendly, no_income_proof, beginner_friendly, digital_first, traditional_bank,
    // international_purchase, spread_rate_quality, insurance_coverage, additional_cards
  }
}

INSTRUÇÕES CRÍTICAS PARA CAPTURA DE DADOS:
1. FIDELIDADE ESTRITA AO TIER / CATEGORIA DO CARTÃO:
Muitas instituições bancárias (ex: C6 Bank, Nubank, Banco Inter, Itaú, Santander, Bradesco, etc.) emitem múltiplos cartões com nomes semelhantes, variando do básico ao alta renda.
Se o cartão solicitado for um cartão básico / de entrada / standard (ex: "Cartão C6", "C6", "Nubank", "Inter Gold", "Itaú Click", "Santander Free / SX"):
- NUNCA substitua pela versão de alta renda (como Black, Carbon, Ultravioleta ou Infinite)!
- Extraia ESTRITAMENTE os dados da versão básica solicitada:
  - name: nome da versão de entrada (ex: "Cartão C6" ou "Cartão C6 Mastercard Standard")
  - slug: "cartao-c6" ou "c6-standard"
  - segment: "ENTRADA" (ou "INTERMEDIARIO")
  - category: "STANDARD" (ou "GOLD" / "INTERNACIONAL")
  - annualFee: 0.0 (sem anuidade para a grande maioria dos cartões de entrada)
  - zeroFees: se anuidade for 0, pode ser [] ou [{ "feeDiscount": 100, "conditions": ["Anuidade gratuita permanente"] }]
  - lounges: se o cartão não dá direito a salas VIP (como a maioria dos cartões de entrada), deixe lounges como [] ou com acessos pagos se aplicável. NUNCA invente salas VIP gratuitas para cartões de entrada.
  - rewards: se tiver programa básico (ex: programa Átomos gratuito do C6 Bank com pontuação por real ou compras), registre a pontuação real correspondente. Se não pontuar, deixe rewards como [].
  - rankAnnuity: 5 (nota máxima por não ter anuidade).
  - rankVipLounges: 1 (sem acesso gratuito a salas VIP).

2. PONTUAÇÃO (rewards): NUNCA resuma apenas a pontuação básica se o texto citar clientes especiais (Select, Private, Personnalité, Estilo), aceleradores (Rewards, Bateu Ganhou) ou metas de fatura. Crie um registro separado para cada condição no array "rewards".
3. OBS_SUMMARY: Destaque as maiores vantagens nos resumos (ex: "Anuidade 100% gratuita", "Pontos Átomos que não expiram").
4. TEXTO LIMPO (SEM CITAÇÕES/LINKS): NUNCA inclua links markdown, URLs, colchetes de fontes ou citações da web (ex: [site.com](url), [1], etc.) dentro dos valores do JSON. Retorne apenas o texto puro e limpo do benefício ou regra.

Critérios OBRIGATÓRIOS no criterionScores (deve conter TODOS com nota 0 a 10):
${CRITERIA_KEYS.join(', ')}

Retorne EXCLUSIVAMENTE o JSON válido, sem comentários e sem crases de markdown.`;

  const userPrompt = useWebSearch
    ? `Pesquise na internet as informações e regras mais recentes e atualizadas de 2026 para o cartão específico solicitado: "${rawText}".
ATENÇÃO CRÍTICA: Extraia estritamente os dados da categoria e variante exata informada ("${rawText}").
Se for um cartão de entrada/básico (ex: "Cartão C6", "Nubank", "Inter"), NÃO confunda e NÃO extraia dados de versões de topo de linha como Black, Carbon ou Ultravioleta. Extraia anuidade real (se gratuita = 0.0), bandeira, pontuação e benefícios específicos deste cartão de entrada. Extraia os dados no JSON solicitado SEM adicionar links ou URLs de fontes no texto.`
    : `Extraia os dados deste cartão a partir do seguinte texto:\n\n${rawText}`;

  const requestBody: any = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  };

  if (useWebSearch) {
    requestBody.plugins = [{ id: 'web' }];
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ocartaoideal.com.br',
      'X-Title': 'O Cartao Ideal - Extrator',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API do OpenRouter (${response.status}): ${errorText}`);
  }

  const result: any = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter retornou resposta vazia.');
  }

  // Limpar possíveis crases de markdown caso o modelo adicione
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as ExtractedCardData;

  // Sanitizar recursivamente para garantir que nenhum link ou citação da web passe para o frontend ou banco
  return sanitizeTextCitations(parsed) as ExtractedCardData;
}

export function sanitizeTextCitations(input: any): any {
  if (typeof input === 'string') {
    return input
      // Remove links markdown no formato [texto](url) ou [site.com](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '')
      // Remove URLs soltas http/https
      .replace(/https?:\/\/[^\s)\]]+/g, '')
      // Remove colchetes de citações numéricas [1], [2] ou vazias []
      .replace(/\[\d+\]/g, '')
      .replace(/\[\s*\]/g, '')
      // Limpar pontuação residual, vírgulas consecutivas e espaços duplos
      .replace(/\s*,\s*(?:,\s*)+/g, ', ')
      .replace(/^[\s,]+|[\s,]+$/g, '')
      .replace(/,\s*\./g, '.')
      .replace(/\s+\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  if (Array.isArray(input)) {
    return input
      .map(sanitizeTextCitations)
      .filter((item) => (typeof item === 'string' ? item.length > 0 : true));
  }

  if (input !== null && typeof input === 'object') {
    const sanitizedObj: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitizedObj[key] = sanitizeTextCitations(value);
    }
    return sanitizedObj;
  }

  return input;
}
