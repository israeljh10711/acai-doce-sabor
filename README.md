# Açaí Doce Sabor

Plataforma de pedidos online da açaiteria Açaí Doce Sabor, de Teixeira, Paraíba. O cliente monta o açaí ou o milk-shake, vê a montagem em 3D e envia o pedido pelo WhatsApp. A loja acompanha os pedidos por um painel administrativo.

## Estado atual

Em 2026-11-11 o projeto concluiu a Fase 1, a fundação: base técnica, navegação e páginas iniciais. O personalizador, a visualização 3D, o carrinho, os pedidos e o painel ainda não existem. Cada um entra em uma fase própria, descrita no roadmap da documentação.

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

## Estrutura

```
assets/blender/        arquivos .blend editáveis
docs/                  documentação que acompanha o código
public/models/         modelos GLB exportados do Blender
src/
  components/          componentes reutilizáveis de interface
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
tests/                 testes de integração e de ponta a ponta
```

As pastas que ainda estão vazias guardam um arquivo `.gitkeep`, só para existirem no repositório.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores. O `.env` não vai para o Git.

Tudo que começa com `VITE_` fica visível no navegador. Só valores públicos entram ali. Chaves secretas nunca ficam neste projeto.

## Convenções

- Nomes de código em inglês; textos de interface em português do Brasil.
- Preços circulam em centavos, como números inteiros.
- Regras de negócio ficam em funções puras, com testes ao lado do arquivo (`*.test.ts`).
- O cardápio original da loja é a fonte de verdade. Sabores, tamanhos e preços não são inventados.
- As cores em `src/index.css` e o ícone em `public/favicon.svg` são provisórios, até a logo oficial chegar.

## Documentação

A documentação principal fica no Obsidian, no vault `segundo cerebro`, pasta `Açaí Doce Sabor/`: visão geral, roadmap, decisões, arquitetura, cardápio, modelos 3D, testes e histórico. A pasta `docs/` deste repositório guarda só o que precisa andar junto com o código.
