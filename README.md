# Crie sua IA — Vercel + Supabase

Site: https://criesuaia.vercel.app/
Webhook VoidPay: https://criesuaia.vercel.app/api/voidpay/webhook

Framework: Other. Diretório de saída: public. Node 24. Todas as imagens, fontes, vozes e vídeos ficam no repositório. A seleção de personagens usa o catálogo recuperado; não é geração nova por IA.

## Configuração protegida na Vercel

- VOIDPAY_PUBLIC_KEY e VOIDPAY_SECRET_KEY: chaves do gateway, somente no servidor.
- VOIDPAY_CALLBACK_URL: URL pública do webhook acima. Cada nova cobrança envia esse callback à VoidPay automaticamente.
- SUPABASE_URL e SUPABASE_SECRET_KEY: credenciais de servidor do banco autorizado. SUPABASE_SERVICE_ROLE_KEY também é aceito para chaves JWT legadas.
- GATEWAY_WEBHOOK_TOKEN: token global quando aplicável. A integração valida prioritariamente o webhookToken retornado pela VoidPay para cada cobrança.

Credenciais nunca devem estar em public/, Git ou logs. O armazenamento usa a tabela exclusiva public.criesuaia_payment_store e a função public.criesuaia_payment_command no projeto Supabase piskou. Os objetos do piskou são preservados. O SQL está em supabase/payments.sql, aplicado como migration criesuaia_payment_storage.

A tabela tem RLS, sem políticas de acesso público intencionalmente. As permissões para anon/authenticated foram revogadas. Somente o servidor com service_role pode executar a função. A função usa SECURITY INVOKER e search_path fixo. CLAIM impede cobranças duplicadas; SAVE/REJECT são transacionais; PAID bloqueia a linha e aplica o pagamento uma vez.

O checkout calcula os valores no servidor, gera QR a partir do código PIX e confirma pagamento exclusivamente por webhook com token, ID, valor, moeda e método corretos. Não utiliza SQLite temporário na Vercel nem Redis pago. Timeout de criação mantém o pedido em verificação para impedir nova cobrança automática.

Não migramos pedidos do localhost. Chat e criação de contas na área de membros ainda dependem de serviços não recuperados.

Teste: npm test. Os testes não geram cobranças reais.
