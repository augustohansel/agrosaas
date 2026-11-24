# Design system · console de gestão rural

## Estrutura visual

A navegação e a área de trabalho ocupam painéis independentes sobre uma moldura neutra. O item ativo combina contorno, brilho diagonal e um ponto de seleção. A gravura em retícula aparece na capa da Visão Geral e no rodapé dos painéis. Tabelas, cartões e drawers usam fundos opacos para proteger a leitura.

Os tokens compartilhados ficam em `src/styles/workspace.css` e `src/styles/variables.css`.

| Uso | Claro | Escuro |
|---|---|---|
| Área de trabalho | `#F7F6EF` | `#1C1E1A` |
| Superfície de tabela, drawer e card | `#FFFDF6` | `#242722` |
| Superfície secundária | `#EFEFE6` | `#2E322A` |
| Texto principal / secundário | `#282E26` / `#62695E` | `#F1F0E7` / `#B7BAAB` |
| Divisor | `#DCDCD0` | `#3D4138` |
| Ação principal | `#356442` | `#45724F` |
| Ênfase verde | `#376344` | `#A6CA9D` |
| Restrição / despesa crítica | `#A43F37` | `#FFA398` |
| Sidebar / item ativo | `#F4F2E8` / `#E0E8D8` | `#23251F` / `#354335` |

DM Sans para interface, Segoe UI como fallback. Título da página entre 28 e 42 px em desktop, seção 18–20 px, tabela e controles 13–15 px. Números usam algarismos tabulares. Reservar monoespaçada para coordenadas, identificadores e horários. Usar espaçamentos de 4, 8, 12, 16, 24 e 32 px. Raio de 8–12 px em controles e 16–22 px em painéis; reduzir a sombra em áreas densas.

## Navegação e composição

- Grupo principal **Fazenda** com Visão Geral, Talhões e Safras. Grupo **Execução** com Estoque, Ordens de Serviço, Frota e Colheita. Grupo **Gestão** com Financeiro e Relatórios. Copiloto e conta ficam sempre alcançáveis. Ícones Lucide de 16–20 px com a mesma espessura.
- O modo compacto mantém nomes acessíveis e tooltips. Em celular, o botão de menu abre a navegação sobre o conteúdo. O foco retorna ao acionador ao fechar.
- O cabeçalho contém seletor de fazenda, safra e pesquisa global. Na visão consolidada, ações de escrita pedem uma propriedade de destino. Filtros de cultura e talhão devem permanecer visíveis no contexto do resultado.
- No Command Center, mostrar primeiro ocorrências com consequência operacional: “Faltam 120 kg para a OS de amanhã”, “Revisão vencida em 18 h” ou “R$ 4.800 vencem hoje”. Cada ocorrência abre o documento e a fazenda correspondentes.
- Usar bento grid quando os módulos têm funções diferentes, como mapa e clima. Listas de lotes, parcelas e ordens pedem linhas alinhadas em tabela.

## Componentes e contratos de interação

| Padrão | Conteúdo mínimo | Comportamento |
|---|---|---|
| KPI de safra | Valor, unidade, período e base da métrica | Abrir composição da métrica por ciclo. Sem denominador, mostrar “Sem área informada”. |
| Tabela de estoque | SKU, unidade, saldo, mínimo, custo médio e lote mais próximo da validade | Ordenar pelo campo visível, filtrar faltas/validade. Expandir lotes e abrir o extrato de movimentos. |
| Ordem de serviço | Data, talhão, operação, operador, máquina e estado | Drawer compara consumo previsto e disponível por lote. Apresentar o total a baixar antes da conclusão. |
| Mapa | Polígonos, camada, legenda com unidade e fonte | Clique, toque ou seleção na lista abrem o mesmo talhão. Separar seleção de edição de vértices; salvar ou cancelar o limite. |
| Drawer de documento | Identificação, contexto, composição, histórico e ação primária | Desktop lateral, celular em tela cheia. Foco contido, fechamento por Escape e aviso de alterações não salvas. |
| Tabela financeira | Data civil, favorecido/descrição, natureza, vencimento e valor | Datas e valores alinhados, filtros por vencimento, safra e fluxo. Identificar parcela liquidada e abrir a transação. |
| Clima e telemetria | Fonte, local, hora de medição e última atualização | Exibir estado desatualizado ou indisponível; mostrar “Simulação” onde houver dados demonstrativos. |
| Copiloto | Campo de busca, consultas, ações e contexto selecionado | `Ctrl/Cmd+K`, setas, Enter e Escape. Uma ação de criação abre formulário com revisão antes de gravar. |

## Leitura em campo

Formatar BRL e números com `Intl.NumberFormat('pt-BR')`; apresentar hectares, kg, L, h, km e sc/ha junto ao valor. Despesa e receita têm rótulo além da cor. Na lista de tarefas, status possui texto e ícone. Ações destrutivas ficam separadas da navegação e explicam o efeito no documento vinculado.

Tratar carregamento, resultado vazio por filtro, cadastro vazio, falha de rede, ausência de permissão e dado desatualizado como estados distintos. Ao enviar uma OS ou liquidação, bloquear envio repetido enquanto a requisição está em curso. Se a resposta se perder, consultar o documento pelo ID. Microinterações de 120–180 ms devem respeitar movimento reduzido. Verificar foco visível, contraste em ambos os temas, zoom a 200% e uso por teclado em cada módulo.
