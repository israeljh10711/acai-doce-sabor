# Açaí Doce Sabor

Plataforma de pedidos online da açaiteria Açaí Doce Sabor, de Teixeira, Paraíba. O cliente monta o açaí ou o milk-shake, vê a montagem em 3D e envia o pedido pelo WhatsApp. A loja acompanha os pedidos por um painel administrativo.

## Estado atual

Em 2026-11-11 o projeto tem a fundação técnica (Fase 1) e a identidade visual com a logo oficial, a página inicial e a área Monte seu Pedido (Fase 2, aguardando a aprovação visual do proprietário). O personalizador, a visualização 3D, o carrinho, os pedidos e o painel ainda não existem. Cada um entra em uma fase própria, descrita no roadmap da documentação.

## Como rodar

Requisitos: Node.js 22.22 ou mais novo e npm.

```
npm install
npm run dev
```

O endereço local aparece no terminal. Por padrão é `http://localhost:5173`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre o site em modo de desenvolvimento |
| `npm run build` | Confere os tipos e gera a versão de produção em `dist/` |
| `npm run preview` | Serve a versão de produção já gerada, para conferência |
| `npm run lint` | Verifica o código com o ESLint |
| `npm run test` | Roda os testes uma vez |
| `npm run test:watch` | Roda os testes de novo a cada alteração |
| `npm run check:pages` | Abre cada página em seis larguras de tela, confere e fotografa |
| `npm run check:contrast` | Mede o contraste de todos os textos contra o nível AA |

Os dois comandos `check:` precisam do site rodando (`npm run dev`) e do Microsoft Edge instalado. Para conferir outro endereço, passe-o no fim: `npm run check:pages -- http://127.0.0.1:4173`.

## Estrutura

```
assets/
  blender/             arquivos .blend editáveis
  brand/               logo original, cópia recortada e o script que gera os arquivos do site
docs/                  documentação que acompanha o código
public/                ícones do site
  models/              modelos GLB exportados do Blender
src/
  assets/brand/        versões da logo usadas nas páginas
  components/
    brand/             a logo
    layout/            cabeçalho, rodapé e largura do conteúdo
    ui/                botões
  pages/               páginas ligadas às rotas
  features/
    catalog/                 cardápio e regras de preço e de adicionais
    configurator-core/       cena 3D compartilhada pelos personalizadores
    acai-configurator/       personalizador do Açaí Tradicional
    oca-configurator/        personalizador do Açaí Oca
    milkshake-configurator/  personalizador do Milk-shake
    cart/                    carrinho
    checkout/                finalização e mensagem do WhatsApp
    admin/                   painel administrativo
  hooks/
  services/            acesso a dados
  types/
  utils/               moeda, telefone e formatação
supabase/migrations/   SQL versionado do banco
tests/
  browser/             conferências feitas em navegador de verdade
```

As pastas que ainda estão vazias guardam um arquivo `.gitkeep`, só para existirem no repositório.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores. O `.env` não vai para o Git.

Tudo que começa com `VITE_` fica visível no navegador. Só valores públicos entram ali. Chaves secretas nunca ficam neste projeto.

## Convenções

- Nomes de código em inglês; textos de interface em português do Brasil.
- Preços circulam em centavos, como números inteiros.
- Regras de negócio ficam em funções puras, com testes ao lado do arquivo (`*.test.ts`).
- O cardápio confirmado pelo proprietário é a fonte de verdade. Sabores, tamanhos e preços não são inventados.
- As cores vêm da logo oficial e ficam em `src/index.css`. Use sempre os nomes de lá (`plum`, `berry`, `leaf`, `cream`), nunca um código de cor solto.
- Os arquivos da logo em `src/assets/brand/` e em `public/` são gerados por `assets/brand/gerar-logo.mjs`. Não edite à mão.
- Todo link ou botão tem pelo menos 44 px de altura e mostra o foco do teclado.

## Documentação

A documentação principal fica no Obsidian, no vault `segundo cerebro`, pasta `Açaí Doce Sabor/`: visão geral, roadmap, decisões, arquitetura, cardápio, modelos 3D, testes e histórico. A pasta `docs/` deste repositório guarda só o que precisa andar junto com o código.
