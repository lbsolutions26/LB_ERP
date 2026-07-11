# Plano de Reimportacao Legado -> Supabase

## Objetivo

Reimportar dados do projeto antigo (Google Sheets publicados em CSV) para o modelo atual, com foco em consistencia historica de vendas e reconciliacao por periodo.

## Entradas esperadas

Arquivo de configuracao: `supabase/legacy-sheets-urls.json`

Formato:

```json
{
  "sheets": [
    { "name": "clientes", "url": "...csv" },
    { "name": "produtos", "url": "...csv" },
    { "name": "pedidos", "url": "...csv" },
    { "name": "pedido_itens", "url": "...csv" },
    { "name": "pagamentos", "url": "...csv" }
  ]
}
```

## Etapas

1. Analise estrutural e relacional
- Rodar: `npm run legacy:analyze`
- Saidas:
  - `supabase/legacy-sheets-analysis.json`
  - `supabase/legacy-sheets-analysis.md`

2. Mapeamento de campos (manual assistido)
- Confirmar para cada origem:
  - chave primaria legada
  - chaves estrangeiras
  - campos de data
  - campos monetarios
  - status

3. Carga por ordem de dependencia
- clientes
- produto_categorias
- produto_catalogo
- formas_pagamento
- documentos_venda
- documento_venda_itens
- contas_receber
- contas_receber_parcelas
- recebimentos

4. Reconciliacao obrigatoria
- contagem por tabela
- primeira/ultima data de venda
- total de vendas por mes (legado x novo)
- total recebido por mes (legado x novo)
- percentual de orfaos em itens e financeiro

## Regras de qualidade

- Operacao idempotente por `(empresa_id, origem, origem_legacy_id)`.
- Datas normalizadas para timezone consistente.
- Valores monetarios tratados com ponto flutuante decimal seguro no banco (numeric).
- Toda linha importada deve manter payload original em json para rastreabilidade.

## Estado atual

- Reset de negocio executado com sucesso.
- Relatorio: `supabase/reset-business-report.json`.
- Aguardando URLs reais das planilhas para iniciar analise de chaves.
