# Ordem de implementação e critérios de aceite

## Entrega 1 · fundação

Artefatos desta etapa: migration incremental transacional, contratos TypeScript agrupados por domínio, teste SQL de contrato, DER e documentação. O schema enviado é a referência de compatibilidade. Homologação contra as políticas existentes e implantação no Supabase remoto são marcos distintos da validação local.

## Entrega 2 · sequência após aprovação do produto

| Ordem | Incremento funcional | Dependências e aceite |
|---|---|---|
| 1 | Layout, sidebar e contexto da safra | Usar sessão existente e seleção de fazenda. Testar owner, viewer e usuário com duas fazendas. Troca de contexto invalida consultas e fecha detalhes antigos. Tema persiste e navegação funciona a 390 px. |
| 2 | Visão Geral | Selecionar safra ativa, consumir `farm_alerts`, `lot_demand`, `cycle_economics` e agenda diária. Cada alerta leva ao item correto. Sem safra, orientar cadastro. Falha da previsão não produz status “Ideal”. |
| 3 | Estoque & Insumos | Cadastro de SKU e lote, compra/NF, mínimo, validade e extrato. Entrada com UUID estável e visualização do custo médio após duas compras a preços distintos. Validar política de quantidade em kg, L e unidades e rejeição de lote vencido. |
| 4 | Talhões, safras e ciclos | Preservar desenhos Leaflet e versões de área apropriadas aos ciclos. Vincular cultura e safra, registrar estágio, abrir histórico e custo. Conferir que editar o desenho não altera custo histórico por hectare. |
| 5 | Frota e OS | Cadastro da máquina, contador, operador membro e tarifa. Planejar doses por lote, iniciar, concluir ou cancelar. Testar saldo insuficiente no segundo lote, duas conclusões simultâneas e máquinas já ocupadas. Conferir contador e custo congelados. |
| 6 | Manutenção, abastecimento e telemetria | Abastecer com baixa de diesel, controlar revisões por data/contador e conciliar `field_operations.order_id`. Uma leitura importada atrasada precisa mostrar seu instante original. Credencial de ingestão fica no backend. |
| 7 | Colheita e armazenagem | Receber romaneio com tara e descontos, conferir kg/saca no ciclo e encaminhar ao destino. Expedir parcialmente, conferir saldo e bloquear saída acima da custódia. |
| 8 | Financeiro e encerramento da safra | Títulos por vencimento e origem, pagamentos, recebimentos e extrato. Comparar margem projetada e realizada e custos diretos, OS e combustível. Conciliar notas de compra e parcelas sem duplicar custo da OS. |
| 9 | Copiloto e navegação transversal | Buscar por propriedade, talhão, lote, OS ou título. Oferecer atalhos de criação autorizados. Consultas de alertas e ranking usam as mesmas fontes das telas. Viewer pode consultar e recebe indicação dos limites de ação. |

Os três primeiros incrementos formam o primeiro lote de frontend. Nos módulos dependentes, cadastros de homologação podem ser preparados antes de suas telas estarem prontas. Recursos simulados atuais, incluindo cultura/produtividade estimadas da demonstração, devem permanecer identificados quando exibidos.

## Homologação e entrada em operação

- **Antes da implantação:** verificar enum de papéis, policies legadas, grants, triggers de criação de perfil, geometria, códigos de categoria e vínculos de talhões em registros históricos. Aprovar classificação dos custos comuns e critério da margem.
- **Ensaio:** restaurar uma cópia isolada, aplicar migrations na ordem documentada e rodar o teste SQL. Em duas sessões concorrentes, disputar o último saldo de um lote, o mesmo título e a mesma OS. Conferir o saldo final e a quantidade de documentos gerados.
- **Homologação do produto:** entrar com duas contas reais de teste e validar escrita e leitura via PostgREST com chave pública. Conferir consultas embutidas de talhões/movimentações, troca de propriedade e política de convites. Testar perda da resposta após commit.
- **Carga inicial:** definir data de corte e inventário físico por lote. Registrar as entradas de abertura com documento identificável e valor conciliado. Vincular transações históricas a ciclos apenas após aprovação do produtor. Importar dados de uma fazenda piloto antes de expandir.
- **Aceite operacional:** confrontar estoque, pesagens e caixa com documentos do piloto. Divergências precisam de rastreabilidade. Fechamento de períodos, estornos formais, transferências entre depósitos e conciliação bancária automática são extensões para um ciclo posterior.
