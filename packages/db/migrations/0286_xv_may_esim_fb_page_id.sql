-- 0285 ghi page_id = id Graph; page_id là id hồ sơ WEB của Page (đường br dùng: web.facebook.com/<page_id>/) — Before You Land = 61595263661095.
UPDATE xv_may SET dang = (SELECT jsonb_agg(CASE WHEN n->>'nen' = 'facebook' THEN jsonb_set(n, '{br,page_id}', '"61595263661095"') ELSE n END) FROM jsonb_array_elements(dang) n)
WHERE ma = 'esimfares-before-you-land';
