
ALTER TABLE public.stickers ADD COLUMN IF NOT EXISTS seq integer;

DELETE FROM public.user_inventory;
DELETE FROM public.stickers;

WITH nations(idx, code) AS (VALUES
  -- Hosts
  (1,'CAN'),(2,'MEX'),(3,'USA'),
  -- UEFA
  (4,'ENG'),(5,'FRA'),(6,'GER'),(7,'ESP'),(8,'ITA'),(9,'NED'),(10,'POR'),(11,'BEL'),
  (12,'CRO'),(13,'DEN'),(14,'SUI'),(15,'POL'),(16,'AUT'),(17,'SRB'),(18,'TUR'),(19,'UKR'),
  -- CONMEBOL
  (20,'ARG'),(21,'BRA'),(22,'URU'),(23,'COL'),(24,'ECU'),(25,'PAR'),(26,'PER'),
  -- AFC
  (27,'JPN'),(28,'KOR'),(29,'IRN'),(30,'KSA'),(31,'AUS'),(32,'QAT'),(33,'IRQ'),(34,'UZB'),
  -- CAF
  (35,'MAR'),(36,'SEN'),(37,'EGY'),(38,'NGA'),(39,'GHA'),(40,'CIV'),(41,'CMR'),(42,'ALG'),(43,'TUN'),(44,'RSA'),
  -- CONCACAF (non-host)
  (45,'CRC'),(46,'PAN'),(47,'JAM'),
  -- OFC
  (48,'NZL')
)
INSERT INTO public.stickers(id, code, nation, slot_num, slot_type, seq)
SELECT (n.idx-1)*20 + g,
       n.code || ' ' || lpad(g::text,2,'0'),
       n.code, g, 'player',
       (n.idx-1)*20 + g
FROM nations n CROSS JOIN generate_series(1,20) g;

INSERT INTO public.stickers(id, code, nation, slot_num, slot_type, seq)
SELECT 960 + g, 'LEG ' || lpad(g::text,2,'0'), 'LEG', g, 'legend', 960 + g
FROM generate_series(1,10) g;

INSERT INTO public.stickers(id, code, nation, slot_num, slot_type, seq)
SELECT 970 + g, 'STA ' || lpad(g::text,2,'0'), 'STA', g, 'stadium', 970 + g
FROM generate_series(1,10) g;
