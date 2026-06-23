-- Seed the 32-realtor pilot list (earns-strategy/resources/militarycalc-outreach-pilot-list-2026-06-23.md)
-- into the militarycalc project. Idempotent: only inserts when the project has no prospects yet,
-- so it is safe to re-run on every deploy (file-runner). base = "<installation>, <ST>" -> the
-- trailing 2-letter code seeds the widget ?state= in the Copy-email template.

INSERT INTO outreach_prospects (project_id, agent_name, company, base, email, contact_url, website, website_etld1, notes)
SELECT v.* FROM (VALUES
  ('militarycalc','Anderson Realty Group',NULL,'Fort Liberty, NC','Concierge@andersonrealtygroup.com',NULL,'https://andersonrealtygroup.com','andersonrealtygroup.com','MRP; Fort Liberty PCS + VA-loan page'),
  ('militarycalc','Moving With Meg',NULL,'Fort Liberty, NC','megan@movingwithmeg.com',NULL,'https://movingwithmeg.com','movingwithmeg.com','PCS to Fort Liberty, Cumberland Co'),
  ('militarycalc','Team Harris Real Estate',NULL,'Fort Liberty, NC',NULL,'https://teamharris.com/about/contact-us/','https://teamharris.com','teamharris.com','Fort Liberty MRP+CIPS relocation page'),
  ('militarycalc','Army Wife Realtor Life',NULL,'Fort Cavazos, TX','realtor.laquitamadison@gmail.com',NULL,'https://armywiferealtorlife.com','armywiferealtorlife.com','Mil spouse; PCS, remote, VA'),
  ('militarycalc','Four22 Realty Group',NULL,'Fort Cavazos, TX','four22realtygroup@gmail.com',NULL,'https://four22realtygroup.com','four22realtygroup.com','PCS to Fort Cavazos housing guide'),
  ('militarycalc','Military Living in Central TX',NULL,'Fort Cavazos, TX','militarylivingincentraltexas@gmail.com',NULL,'https://militarylivingincentraltexas.com','militarylivingincentraltexas.com','Brand = military relocation, Harker Heights'),
  ('militarycalc','Clarksville Home Sales',NULL,'Fort Campbell, TN',NULL,'https://www.clarksvillehomesales.us/','https://clarksvillehomesales.us','clarksvillehomesales.us','Fort Campbell relocation; MRP+ABR'),
  ('militarycalc','Kimberly Kielor (TennLiving)',NULL,'Fort Campbell, TN','kimberlykielor@gmail.com',NULL,'https://tennliving.com','tennliving.com','Mil-spouse; PCS/VA page'),
  ('militarycalc','Angie McCormick',NULL,'Fort Campbell, TN','angie@forsaleinclarksville.com',NULL,'https://forsaleinclarksville.com','forsaleinclarksville.com','PCS to Ft. Campbell guide'),
  ('militarycalc','Operation Red Dot',NULL,'JBLM, WA','HQ@OperationRedDot.com',NULL,'https://operationreddot.com','operationreddot.com','Veteran-led near JBLM (bulk: network)'),
  ('militarycalc','JBLM Home Finder',NULL,'JBLM, WA',NULL,'https://www.jblmhomefinder.com/connect','https://jblmhomefinder.com','jblmhomefinder.com','PCS in/out of JBLM'),
  ('militarycalc','Veterans Agents',NULL,'JBLM, WA',NULL,'https://www.veteransagents.com/','https://veteransagents.com','veteransagents.com','JBLM community guides'),
  ('militarycalc','Sandra K Realtor',NULL,'Camp Pendleton, CA','sandra@sandrakrealtor.com',NULL,'https://sandrakrealtor.com','sandrakrealtor.com','Camp Pendleton PCS Housing Guide 2026'),
  ('militarycalc','San Diego Military Realtor',NULL,'Camp Pendleton, CA',NULL,'https://www.sandiegomilitaryre.com/contact/','https://sandiegomilitaryre.com','sandiegomilitaryre.com','Whole site = PCS + VA; MRP'),
  ('militarycalc','Arrive Realty',NULL,'Camp Pendleton, CA','edward@arriverealty.com',NULL,'https://arriverealty.com','arriverealty.com','100+ Pendleton PCS families'),
  ('militarycalc','Tip of the Spear',NULL,'Naval Base San Diego, CA','brian@tipofthespearrealtors.com',NULL,'https://tipofthespearrealtors.com','tipofthespearrealtors.com','32nd St + Pendleton relocation page (bulk)'),
  ('militarycalc','Tamara Krause',NULL,'Naval Base San Diego, CA','tamara.krause@c21affiliated.com',NULL,'https://tamarakrause.com','tamarakrause.com','MRP; Sell Before PCS'),
  ('militarycalc','1827 Real Estate',NULL,'Fort Moore, GA','terri@1827realestate.com',NULL,'https://1827realestate.com','1827realestate.com','MRP PCS to/from Fort Benning (bulk)'),
  ('militarycalc','McLain Real Estate Team',NULL,'Fort Moore, GA','pcsfortbenning@gmail.com',NULL,'https://fortbenningrelo.com','fortbenningrelo.com','MRP Fort Benning PCS'),
  ('militarycalc','Fort Benning PCS Real Estate',NULL,'Fort Moore, GA',NULL,'https://www.fortbenningpcs.com/','https://fortbenningpcs.com','fortbenningpcs.com','MRP team 100+ deals/yr (bulk)'),
  ('militarycalc','Jennifer Dawn REALTOR',NULL,'Naval Station Norfolk, VA','jennifer@jenniferdawnrealestate.com',NULL,'https://jenniferdawnrealestate.com','jenniferdawnrealestate.com','Dedicated NS Norfolk MRP page'),
  ('militarycalc','The Real Estate Group (TREG)',NULL,'Naval Station Norfolk, VA',NULL,'https://treg.com/contact/','https://treg.com','treg.com','Hampton Roads; MilVet United Network (bulk)'),
  ('militarycalc','The Doll Team',NULL,'Naval Station Norfolk, VA','amydoll@remax.net',NULL,'https://dollteam.com','dollteam.com','Veteran/women-owned; PCS testimonials'),
  ('militarycalc','Beaton Brothers Property Experts',NULL,'Fort Carson, CO',NULL,'https://www.beatonbrotherspropertyexperts.com/contact-us/','https://beatonbrotherspropertyexperts.com','beatonbrotherspropertyexperts.com','All-MRP veteran/spouse team (bulk)'),
  ('militarycalc','The Warner Group',NULL,'Fort Carson, CO','rob@warnergroupco.com',NULL,'https://warnergroupco.com','warnergroupco.com','Veteran-owned PCS-info page'),
  ('militarycalc','Pena El Paso Realty Group',NULL,'Fort Bliss, TX','john@penaelpaso.com',NULL,'https://penaelpaso.com','penaelpaso.com','WARMEST: already publishes 2026 BAH by grade by hand'),
  ('militarycalc','Sandy Messer & Associates',NULL,'Fort Bliss, TX','relo@sandymesser.com',NULL,'https://sandymesser.com','sandymesser.com','Hundreds relocated to Fort Bliss'),
  ('militarycalc','Christopher Beal',NULL,'Joint Base San Antonio, TX','gobealgroup@gmail.com',NULL,'https://veteranrealestatesa.com','veteranrealestatesa.com','Army vet+MRP; Lackland/Sam Houston/Randolph'),
  ('militarycalc','Tami Price',NULL,'Joint Base San Antonio, TX','info@tamiprice.com',NULL,'https://tamiprice.com','tamiprice.com','MRP; 2026 PCS-to-JBSA guide'),
  ('militarycalc','912 Living (Jessica Victoria)',NULL,'Fort Stewart, GA','jessica@912-living.com',NULL,'https://912-living.com','912-living.com','MRP+CMRS; firm = Fort Stewart mil families (bulk)'),
  ('militarycalc','Barela Real Estate Group',NULL,'Fort Stewart, GA','cathleen@barelarealestate.com',NULL,'https://barelarealestate.com','barelarealestate.com','WARMEST: Military PCSing Support cites 2026 BAH'),
  ('militarycalc','Drew Doheny PM & RE',NULL,'Fort Stewart, GA',NULL,'https://drewsellsga.com/contact-us','https://drewsellsga.com','drewsellsga.com','50-60 soldiers/yr to Stewart/HAAF')
) AS v(project_id, agent_name, company, base, email, contact_url, website, website_etld1, notes)
WHERE NOT EXISTS (SELECT 1 FROM outreach_prospects WHERE project_id = 'militarycalc');
