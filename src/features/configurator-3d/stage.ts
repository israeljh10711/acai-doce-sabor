/**
 * Fundo do estúdio da cena 3D, igual ao do quadro da prévia (e da prévia ilustrada).
 * A cena desenha esse fundo de propósito: o vidro e o plástico mostram o que está atrás deles, e
 * sem fundo na cena o three.js põe branco ali (halo nas bordas do copo).
 *
 * Fica fora de ProductScene.tsx para a página não baixar o three.js só para saber a cor.
 */
export const STAGE_COLOR = '#f8f6f9'
