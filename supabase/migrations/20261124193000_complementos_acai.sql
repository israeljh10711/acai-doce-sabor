begin;

update public.catalog_products set completo = false
where id = 'acai-oca' and completo;

update public.catalog_products
set details = jsonb_set(details, '{tagline}', to_jsonb('Do seu jeito: escolha os complementos um a um ou peça o Completo.'::text))
where id = 'acai-tradicional'
  and details->>'tagline' = 'Do seu jeito: adicionais grátis conforme o tamanho, mais frutas e coberturas à vontade.';

commit;
