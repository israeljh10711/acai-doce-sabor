# Fase 4 — Personalizador em 3D

Desenho aprovado pelo proprietário em 2026-11-12. Substitui a prévia 2D da Fase 3 pelo 3D
feito no Blender, mantendo a mesma regra de composição.

## Intenção

O cliente vê o produto que está montando em 3D, só com o que escolheu, e pode girá-lo.
Precisa funcionar bem no celular.

## Decisões

1. **Modelagem por script.** Recipientes, bases e ingredientes são gerados por scripts Python
   rodados no Blender, guardados em `assets/blender/scripts/`. O arquivo editável fica em
   `assets/blender/`. Medida mudou: roda o script de novo.
2. **Medidas aproximadas, numa tabela só:** `src/features/configurator-3d/medidas.json`,
   lida pelo script do Blender e pelo site. Valores típicos de mercado, marcados como
   aproximados até o proprietário mandar as medidas reais.
3. **Um GLB por modelo**, em `public/models/`: `container-<tamanho>.glb`,
   `base-<produto>-<tamanho>.glb`, `topping-<ingrediente>.glb`. O celular baixa só o que foi escolhido.
4. **Mesma regra de composição.** `composeIllustration` (Fase 3) continua decidindo o que
   aparece; a cena 3D desenha essas camadas. Ingredientes entram com animação curta.
5. **Carregamento em etapas.** three.js, React Three Fiber e Drei só carregam no
   personalizador. A prévia 2D aparece na hora e dá lugar ao 3D quando ele fica pronto. Sem
   WebGL, fica a prévia 2D com o aviso de que o 3D não está disponível.
6. **Girar:** no computador, arrastando a prévia. No celular, a prévia pequena não gira (não
   rouba a rolagem); o botão "Ver em 3D" abre uma visualização maior, que gira com o dedo.
7. **Página inicial:** os cartões mostram imagens renderizadas no Blender, com aspecto de foto.
8. **Leveza:** a cena só redesenha quando algo muda ou o cliente gira; resolução limitada no
   celular; sem mapas de ambiente baixados de terceiros; ingredientes repetidos com instâncias.

## Fora do escopo

Simulação física; texturas pesadas; modelos de terceiros ou gerados por IA.

## O que não pode acontecer

A cena mostrar algo não escolhido; o 3D travar a página no celular; um aparelho sem WebGL
ficar sem prévia.
