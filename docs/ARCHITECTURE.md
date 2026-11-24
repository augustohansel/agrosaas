# Gestia · arquitetura operacional

## Escopo e ponto de partida

A unidade de isolamento é a fazenda. A unidade de análise agronômica e de resultado é o **ciclo de cultivo**. Ele identifica um talhão em uma safra e fixa a área e a massa da saca usadas nos cálculos. A geometria continua no JSONB de `plots`, compatível com os vértices usados pelo Leaflet.

| Base recebida | Responsabilidade preservada | Lacuna tratada |
|---|---|---|
| `profiles`, `farms`, `farm_members` | Identidade Supabase, coordenadas e participação | Autorização explícita, por operação e por coluna |
| `plots` | Nome, desenho e edição dos limites | Ciclo com cultura, estágio, histórico e área de referência |
| `transactions` | Caixa efetivamente movimentado | Safra via ciclo, natureza econômica e liquidação de títulos |
| `field_operations` (migration anterior do repositório) | Leituras de máquina, progresso e insumo da frente de trabalho | Ligação opcional a uma OS identificada |

Os dados existentes permanecem legíveis. Um lançamento antigo sem ciclo continua no caixa da fazenda. A classificação retroativa exige conciliação pelo produtor. O cadastro existente de fazenda continua aceitando a sequência de criação da propriedade e inclusão do próprio proprietário. Uma falha entre essas chamadas pode deixar uma fazenda sem vínculo. A Entrega 2 pode reunir as duas gravações em uma RPC.

## Do planejamento ao resultado

1. O gestor cria uma safra, cadastra o ciclo por talhão e fixa área, saca, orçamento, preço e produtividade esperada. Há no máximo uma safra ativa por fazenda. A safrinha pode ter uma safra própria. Cada mudança de estágio gera um registro datado.
2. O almoxarifado cadastra insumo/lote e lança a entrada com quantidade na unidade-base, preço por unidade e identificação da nota. Uma ou mais parcelas a pagar podem apontar para essa entrada. A classificação financeira da compra é `inventory`.
3. O planejamento monta a OS com ciclo, operador membro, máquina, área e doses por hectare distribuídas pelos lotes. A soma das doses do mesmo insumo forma a dose total. Uma OS planejada não reserva estoque. A tela deve comparar a demanda das OS abertas ao saldo disponível por lote e à validade.
4. A OS passa de `planned` para `running`. Ao concluir, a RPC bloqueia a ordem, calcula o consumo de cada lote, baixa as quantidades, congela o custo de insumos e máquina e atualiza o contador. Qualquer falha desfaz a conclusão inteira. Cancelamento é permitido antes da conclusão.
5. O romaneio registra origem, destino e pesagem. O peso líquido é bruto menos tara e descontos em kg conforme o comprovante de recebimento. Umidade e impurezas são medições. Aplicar automaticamente as porcentagens como desconto adicional duplicaria descontos já lançados. A expedição só aceita quantidade coberta no destino e ciclo.
6. A venda pode gerar título vinculado ao romaneio. Na liquidação, o banco gera exatamente um lançamento. Valores em aberto alimentam previsão de caixa e contas a vencer. A margem realizada usa receitas de venda recebidas e custos apropriados ao ciclo.

## Critérios de apropriação

| Evento | Caixa | Resultado do ciclo |
|---|---|---|
| Recebimento de insumo e pagamento da nota | Despesa na liquidação | Consumo ao custo médio na OS |
| Máquina utilizada | Horas apontadas, sem lançamento fictício | Horas × tarifa congelada na conclusão |
| Abastecimento | Pagamento da compra do diesel | Baixa ao custo médio quando o abastecimento informa ciclo |
| Manutenção | Título `equipment` e liquidação | Recuperada pela tarifa da máquina |
| Serviço externo específico | Pagamento com `cost_basis=direct` | Despesa direta do ciclo |
| Venda de grãos | Entrada liquidada como `sale` | Receita recebida do ciclo |

Cadastre a tarifa por hora **incluindo a provisão de manutenção e excluindo combustível apropriado separadamente**. Abastecimentos sem ciclo são custos comuns da frota. Evite lançar o mesmo diesel como abastecimento e como linha de consumo da OS. Para preço e produtividade, a unidade-base é a saca configurada por ciclo. Arredonde os valores monetários para exibição somente no limite da interface.

A OS captura a leitura inicial da máquina ao entrar em execução. Para horímetro, a conclusão conserva a maior leitura entre o contador observado e a leitura inicial acrescida das horas trabalhadas. Assim, abastecer durante a OS não duplica as horas do mesmo intervalo. Cada máquina e cada operador têm no máximo uma OS em execução por fazenda. Máquinas em km exigem odômetro final ao concluir. O custo/hora continua baseado no tempo de trabalho.

## Estoque e concorrência

O lote responde pela quantidade disponível e pela validade. O SKU responde pelo valor contábil somado de todos os lotes. A entrada adiciona quantidade e valor ao saldo. A saída utiliza o custo médio do SKU imediatamente antes da baixa. O valor estendido retém oito casas decimais. Estoque zerado apresenta custo médio nulo.

Recebimento e abastecimento recebem um UUID criado pelo cliente para cada intenção de lançamento. Após perda da resposta, consulte `stock_moves.id` na mesma fazenda. Uma repetição com o mesmo ID falha por unicidade e reverte os efeitos da tentativa. Compare os campos antes de considerar a primeira operação confirmada. Para conclusão de OS e liquidação, a própria chave da ordem ou do título protege a repetição. Trate deadlock ou falha de serialização com retentativa da transação inteira e a mesma identidade.

## Consultas para as telas da Entrega 2

| Módulo | Leitura e ação |
|---|---|
| Visão geral | Safra ativa → ciclos → `cycle_economics`; somar valores e áreas antes de dividir. `farm_alerts` cobre saldo mínimo, manutenção por data/contador e títulos abertos vencidos ou a vencer em sete dias. Agenda vem de `work_orders.planned_on`. |
| Geoespacial | Desenhos de `plots` e drawer do ciclo com estágio, histórico de estágios, ordens concluídas, romaneios e custo acumulado. NDVI permanece identificado como simulado enquanto faltar fonte orbital. |
| Estoque | `inputs` → lotes → eventos. Mostrar saldo, unidade, custo médio, validade, demanda prevista e origem documental. |
| OS | Planejamento por talhão, lotes, máquina e operador. Usar `advance_order` para transições e associar leituras de `field_operations.order_id` quando houver integração. |
| Frota | Cadastro, leitura corrente, abastecimentos, horas de OS, custo da manutenção e próximo vencimento. Uma leitura de progresso não conclui automaticamente a OS. |
| Colheita | Cargas por ciclo e destino, expedições e `grain_balances`; produtividade = kg líquidos ÷ kg/saca ÷ hectares do ciclo. |
| Financeiro | Agenda de `bills`, fluxo realizado de `transactions`, comparativo de margens em `cycle_economics`. Liquidação integral por parcela; divida o compromisso em títulos por vencimento. |
| Copiloto | Atalhos para as mesmas rotas e comandos validados dos formulários. Para maior custo/ha, ordenar `cycle_economics.cost_per_ha` por safra, com desempate por ciclo. Alertas usam a mesma visão do painel. |

O widget meteorológico existente consulta previsão na localização da fazenda. Exibir fonte, horário, dados ausentes e horizonte de chuva. A leitura meteorológica e o status de triagem pertencem à camada operacional. Um indicador climático não autoriza consumo de insumo nem execução de OS.

## Fronteiras do frontend

```text
src/
  components/             Layout, seletores e drawers compartilhados
  contexts/               sessão operacional e seleção da fazenda
  services/supabase.ts    cliente com credencial pública e sessão do usuário
  shared/contracts/       escalares, enums, contrato das RPCs e exportação dos tipos
  features/
    farms/ plots/ transactions/   serviços existentes
    field/                        painel, demonstração, mapa, clima e comandos existentes
    identity/ seasons/ inventory/ operations/
    fleet/ harvest/ finance/ overview/  contratos de leitura por domínio
  pages/                  entradas das rotas existentes
supabase/migrations/      DDL versionado, permissões, triggers, visões e RPCs
supabase/tests/           teste SQL de reconciliação e isolamento
docs/                     decisões, dicionário, linguagem visual e sequência de entrega
```

Na Entrega 2, cada domínio ganha serviços, consultas e componentes conforme suas telas forem implementadas. Componentes não escrevem saldo ou custo calculado. Uma chave de consulta deve incluir sessão, fazenda, safra e filtros relevantes. Em “todas as fazendas”, agregue apenas leituras permitidas e exija fazenda específica para criar documentos. Na troca de tenant, descarte resultados atrasados e reinicie o contexto do drawer.
