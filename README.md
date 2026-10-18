# Crie sua IA — Vercel + Supabase

Site: https://criesuaia.vercel.app/
Webhook VoidPay: https://criesuaia.vercel.app/api/voidpay/webhook

Framework: Other. Diretório de saída: public. Node 24. Todas as imagens, fontes, vozes e vídeos ficam no repositório. A seleção de personagens usa o catálogo recuperado; não é geração nova por IA.

## Configuração protegida na Vercel

- VOIDPAY_PUBLIC_KEY e VOIDPAY_SECRET_KEY: chaves do gateway, somente no servidor.
- VOIDPAY_CALLBACK_URL: URL pública do webhook acima. Cada nova cobrança envia esse callback à VoidPay automaticamente.
- SUPABASE_URL e SUPABASE_SECRET_KEY: credenciais de servidor do banco autorizado. SUPABASE_SERVICE_ROLE_KEY também é aceito para chaves JWT legadas.
- VOIDPAY_FALLBACK_EMAIL, VOIDPAY_FALLBACK_PHONE e VOIDPAY_FALLBACK_DOCUMENT: a VoidPay exige e-mail, celular e CPF/CNPJ do cliente. Quando o lead não informa (ou informa inválido) celular ou CPF, esses dados são enviados no lugar. Ficam só na Vercel porque o repositório é público, e não são repassados à Meta como dados do lead.

Credenciais nunca devem estar em public/, Git ou logs. O armazenamento usa a tabela exclusiva public.criesuaia_payment_store e a função public.criesuaia_payment_command no projeto Supabase piskou. Os objetos do piskou são preservados. O SQL está em supabase/payments.sql, aplicado como migration criesuaia_payment_storage.

A tabela tem RLS, sem políticas de acesso público intencionalmente. As permissões para anon/authenticated foram revogadas. Somente o servidor com service_role pode executar a função. A função usa SECURITY INVOKER e search_path fixo. CLAIM impede cobranças duplicadas; SAVE/REJECT são transacionais; PAID bloqueia a linha e aplica o pagamento uma vez.

O checkout calcula os valores no servidor e gera QR a partir do código PIX. O aviso da VoidPay não segue o formato documentado (TRANSACTION_PAID com token), então o webhook usa só o ID da transação e confirma o pagamento consultando a própria VoidPay (GET /transactions?id=): status COMPLETED, pedido (clientIdentifier), valor, moeda BRL e método PIX. Não utiliza SQLite temporário na Vercel nem Redis pago. Timeout de criação mantém o pedido em verificação para impedir nova cobrança automática.

Não migramos pedidos do localhost. Chat e criação de contas na área de membros ainda dependem de serviços não recuperados.

Teste: npm test. Os testes não geram cobranças reais.

## Pixel Meta

Pixel exclusivo: 1422813852615307. PageView é enviado uma vez por carregamento pelo app original; o bootstrap apenas inicializa o pixel. Os eventos customizados do quiz são preservados. InitiateCheckout ocorre ao entrar no checkout; AddPaymentInfo e PixGerado somente após criar PIX; Purchase e PagamentoConfirmado somente após status pago confirmado pelo servidor. Purchase usa valor real do pedido, BRL e eventID purchase_<hash>, com deduplicação entre polling e navegador/servidor. Os MP3 e vídeos não foram alterados por esta integração.

A API de Conversões está preparada, mas requer META_CAPI_ACCESS_TOKEN nas variáveis protegidas da Vercel. Sem token, compras são registradas pelo pixel enquanto a página consulta o status. Com token, o webhook confirmado envia Purchase mesmo com a página fechada. Eventos são persistidos antes da confirmação; falhas de envio retornam 503 ao gateway para solicitar retry, sem desfazer o pagamento. E-mail e telefone enviados à Meta são hashes SHA-256; os cookies fbp/fbc não são hashados. Não se envia CPF. META_TEST_EVENT_CODE é opcional para teste no Events Manager.

Referências: https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking/ e https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/

## Tela inicial e pedido de e-mail (desativados)

O site abre direto na primeira pergunta, com o título "Crie sua namorada IA em 40 segundos" e a contagem "1 de 7". O e-mail não é pedido em nenhuma etapa: a cobrança na VoidPay vai com VOIDPAY_FALLBACK_EMAIL.

Para voltar, edite em public/assets/index-B-OgTTgT.js as chaves junto de `qzOrder`:

- `qzShowHome=!1` → `qzShowHome=!0` traz de volta a tela inicial (imagem com "Começar a criar agora"). Para ver só uma vez, sem mudar nada, abra o site com `?inicio=1`.
- `qzAskEmail=!1` → `qzAskEmail=!0` traz de volta a tela de nome e e-mail antes da revelação e o campo de e-mail obrigatório no checkout (o servidor aceita os dois casos).

A versão completa anterior está na tag `backup-com-tela-inicial` do GitHub.

## Conversa de amostra e telefone

Depois da revelação, "Conversar Agora" abre uma conversa de amostra: ela manda três mensagens (chamando o cliente pelo nome, conforme o tipo de relação escolhido), uma foto borrada com cadeado e o card "Desbloqueie para ver a foto e continuar conversando" com o preço; o botão leva direto ao checkout e "Ver tudo o que está incluso" abre a página da oferta. O checkout não pede telefone: a VoidPay recebe VOIDPAY_FALLBACK_PHONE (a oferta de WhatsApp continua pedindo o número para a entrega).

Chaves junto de `qzOrder` em public/assets/index-B-OgTTgT.js: `qzTeaserOn=!1` volta a mandar "Conversar Agora" direto para a oferta; `qzAskPhone=!0` volta com o campo de telefone no checkout.

O funil anterior a essas mudanças está na tag `funil-heitormanja` do GitHub.

## Checkout depois da conversa

"Desbloquear" leva ao checkout, que gera o PIX automaticamente (chave `qzAutoPix`; com `qzAutoPix=!1` volta o botão "Gerar meu PIX"). Se a geração falhar, aparece o checkout com a mensagem de erro e o botão para tentar de novo. O checkout mostra a foto dela e "Desbloquear a <nome> · Fotos + conversa", explica o PIX copia e cola antes do botão e traz os order bumps abaixo dele; não há mais banner nem cronômetro. "← voltar", no checkout e na tela do PIX, volta para a conversa já completa.
