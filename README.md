# Crie sua IA — Vercel + Supabase

## México: original brasileiro de 22/10/2026

`/mexico` agora usa as perguntas, opções, traduções e navegação capturadas de
https://criesuaia.shop/ em 22/10/2026. O snapshot está em `source/brasil-2026-10-22`
com hashes SHA-256. São 18 perguntas (a voz em português não é oferecida no México),
com estilo realista/anime, idade, aparência e personalidade. Continuam a preparação
com foto, etapas separadas de correio, nome da IA e nome da pessoa, em espanhol mexicano, revelação, oferta, checkout e oferta VIP mexicana.
O catálogo recuperado seleciona imagens/vídeos existentes; não gera personagens
novas nem representa todas as preferências visuais com arquivos exclusivos.

Melhorias: espaço correto entre palavras destacadas, prevenção de avanço por
toque duplo e progresso acessível, sem numeração visível de etapas; início por toque, sem
avanço automático após 5 segundos. Os preços continuam MX$ 99 e o pagamento é
SPEI/OXXO pela LiberPay. Pedidos pendentes e pagamentos anteriores mantêm suas
chaves de recuperação. O quiz tem estado separado para não confundir posições
das sete perguntas antigas. O evento `funnel_version` identifica `mx-br-20261022-original-revisado`
nos dados do funil; nenhum aumento de vendas foi presumido ou medido ainda.

Build: `python3 tools/build-mx.py`. O adaptador `tools/mx-original.py` importa o
questionário do snapshot e preserva o checkout e o rastreamento mexicanos.
`source/mexico-base` guarda a entrada estável de `tools/build-ar.py`, de modo que
recompilar a Argentina não aplique o novo questionário por acidente.

Backup completo anterior: `../backups/funil-mexico-antes-brasil-20261022-193632.zip`,
commit `747d8ed`. O ZIP contém os arquivos versionados completos, sem credenciais.
Para restaurar, extraia-o em outro diretório e publique a pasta `vercel`.

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

## Estilo anime ou realista

A primeira pergunta é "Escolha o estilo dela" (Realista ou Anime). Com Anime, as perguntas seguintes mostram as fotos em anime (etniaAnime, corpoAnime, seiosAnime, bundaAnime, cabeloAnime, corcabeloAnime e a prévia de fotos). A personagem revelada para quem escolhe anime vem de public/anime-results (as personagens anime do Piskou, escolhidas por origem, cor do cabelo, corpo, seios e bumbum); no anime só aparecem as cores preto, castanho e loiro, e a oferta do vídeo é pulada porque essas personagens não têm vídeo. O realista continua com o catálogo atual. O checkout voltou ao original: a pessoa toca em "Gerar meu PIX".

## México (/mexico)

Versão em espanhol do México em https://criesuaia.vercel.app/mexico, gerada a partir do site brasileiro por `python3 tools/build-mx.py` (gera public/assets/index-mx.js e public/mexico/index.html; rode de novo sempre que mudar o bundle brasileiro). Mesmo funil (anime ou realista, silhueta, conversa de amostra, upsells), sem a pergunta de voz, com preços em pesos (lib/catalog-mx.json: MX$ 99 de MX$ 249, bumps MX$ 39, upsells MX$ 49 a 149).

Pagamento pela LiberPay em MXN: SPEI (CLABE para transferir, confirma em segundos) ou OXXO (referência com código de barras, confirma em horas); upsells sempre por SPEI. O servidor troca LIBERPAY_CLIENT_ID + LIBERPAY_CLIENT_SECRET por um token em POST /auth/token e cria a cobrança em POST /payments/deposit; o e-mail do pagador (obrigatório em MXN) é VOIDPAY_FALLBACK_EMAIL. A LiberPay só aceita IPs liberados no painel dela, e os IPs de saída da Vercel mudam; se a LiberPay não puder liberar a chave para qualquer IP, configure LIBERPAY_PROXY_URL (ex.: http://usuario:senha@host:porta de um proxy com IP fixo) e libere o IP desse proxy no painel. Hoje o projeto usa os IPs fixos da Vercel (Advanced Networking, us-east-1: 155.121.192.6 a 155.121.192.11), liberados na LiberPay; depois de ativar IPs fixos é preciso publicar de novo. Webhook a cadastrar no painel da LiberPay: https://criesuaia.vercel.app/api/liberpay/webhook (payment.paid confirma o pedido e envia o Purchase em MXN para a Meta).


Revisão do original publicado em 22/10/2026: o bundle ao vivo mantém o hash
8b3fc804ce6fa1e4809374e6e7325e453bffb37d976e6089645557a4bfb527cb.
Ordem conferida: início → perguntas → preparação → e-mail → nome da IA →
nome da pessoa → prévia → oferta → checkout com dois adicionais opcionais →
pagamento → oferta VIP → confirmação/acesso. O México agora segue essa ordem,
inclusive a ilustração original de preparação e as duas telas de nomes.
Os adicionais ficam desmarcados por padrão e entram no total somente ao selecionar.
A sequência mexicana anterior de oito upsells foi substituída por uma oferta VIP.
Mantidas as adaptações regionais: espanhol, MXN, SPEI/OXXO e pixel do México;
voz em português omitida. Por preferência expressa, o modal não mostra porcentagem
e o quiz não mostra números de etapa.
