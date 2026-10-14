# Crie sua IA — Vercel

Importe este repositório na Vercel. Framework Preset: **Other**. Root Directory: raiz. Output Directory: `public`. Sem build ou dependências. Node 24.

Todos os arquivos de imagens, fontes, vozes e vídeos ficam em `public/`. Quiz, personagem final e botões de voz incluem as correções locais. A seleção final usa o catálogo recuperado, não geração nova por IA.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

- `VOIDPAY_PUBLIC_KEY` e `VOIDPAY_SECRET_KEY`: chaves da conta VoidPay, somente no servidor.
- `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`: crie um Redis Upstash na integração/Marketplace da Vercel. Deve usar persistência, sem expiração automática ou eviction dos pedidos.
- `VOIDPAY_CALLBACK_URL`: `https://SEU-DOMINIO/api/voidpay/webhook`.
- `GATEWAY_WEBHOOK_TOKEN`: token global do painel quando aplicável; tokens por cobrança retornados pela VoidPay são armazenados e validados automaticamente.

Após configurar as variáveis, faça Redeploy. Não coloque chaves no código ou em public/. `.env.example` não contém credenciais reais.

## Pagamentos

API em `api/checkout.js`; receptor em `api/voidpay/webhook.js`. Redis mantém pedidos entre invocações, trava cobranças repetidas e atualiza pagamento atomicamente. Não utiliza SQLite temporário da Vercel. Sem configurar Redis e chaves, a API retorna erro de configuração e não gera cobranças. Timeout deixa o pedido em verificação para impedir cobrança duplicada. Rejeições HTTP definitivas permitem nova tentativa. Aprovação depende exclusivamente do webhook autenticado e validado.

Os pedidos do localhost não são migrados. Chat e criação de contas na área de membros continuam dependentes dos serviços originais, que não foram recuperados.

Teste: `npm test`. Os testes não geram cobranças reais.
