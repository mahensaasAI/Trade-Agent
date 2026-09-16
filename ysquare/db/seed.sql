-- Y Square Workplace — reference and sample data. Safe to re-run (ON CONFLICT / WHERE NOT EXISTS).

-- Admin: same account and password as WorkPlace / Neon Logistics (hash = SHA-256(password:email)). Premium so every model can be tested.
INSERT INTO ys_users (id,name,email,role,plan,plan_source,initials,password_hash,active)
VALUES ('user-raju','Raju','raju@oradayforce.com','admin','premium','seed','R','fbfb9be1312318c4bb00317236184b8a45776d905ff69d7f6e53524c996bcc7f',true)
ON CONFLICT (id) DO UPDATE SET role='admin', plan='premium', active=true;

-- Models. Free tier: Gemini Flash, Mistral, Groq. Premium tier: Claude and ChatGPT.
INSERT INTO ys_models (id,provider,label,model_id,tier,description,enabled,sort) VALUES
 ('gemini','google','Gemini Flash','models/gemini-2.5-flash','free','Google Gemini 2.5 Flash - fast, free tier default',true,1),
 ('mistral','mistral','Mistral','mistral-small-latest','free','Mistral Small - quick and economical',true,2),
 ('groq','groq','Groq','openai/gpt-oss-120b','free','OpenAI gpt-oss 120B on Groq - very fast responses',true,3),
 ('claude','anthropic','Claude','claude-sonnet-4-6','premium','Anthropic Claude Sonnet 4.6 - best reasoning and writing (Premium)',true,4),
 ('chatgpt','openai','ChatGPT','gpt-5-mini','premium','OpenAI GPT-5 mini (Premium)',true,5)
ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label, model_id=EXCLUDED.model_id, tier=EXCLUDED.tier, description=EXCLUDED.description, sort=EXCLUDED.sort;

INSERT INTO ys_agent_settings (agent_id,default_model,enabled,updated_by) VALUES
 ('agent-athlete','gemini',true,'seed'),
 ('agent-studypals','studypals',true,'seed'),
 ('agent-events','gemini',true,'seed')
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO ys_settings (key,value) VALUES
 ('organization','{"name":"Y Square","platform":"Y Square Workplace","tagline":"Three agents for young athletes, students and community events","timezone":"America/Chicago","currency":"USD"}'::jsonb),
 ('auth','{"googleClientId":"","sessionHours":24}'::jsonb),
 ('billing','{"provider":"stripe_payment_link","checkoutUrl":"","priceLabel":"$9 / month","premiumBenefits":["Claude and ChatGPT on every agent","Longer conversations and history","Priority support"]}'::jsonb),
 ('studypals','{"baseUrl":"https://n8n-neonai.duckdns.org/webhook/studypals/","tutorPath":"tutor/ask","openUrl":"https://n8n-neonai.duckdns.org/studypals/"}'::jsonb),
 ('limits','{"guestDailyMessages":30,"freeDailyMessages":150,"premiumDailyMessages":1000,"maxMessageChars":6000}'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- The StudyPals tutor webhook lives under /webhook/studypals/ (the /studypals/ path serves the static app); move an old default.
UPDATE ys_settings SET value = value || '{"baseUrl":"https://n8n-neonai.duckdns.org/webhook/studypals/"}'::jsonb, updated_at = now()
 WHERE key='studypals' AND value->>'baseUrl' = 'https://n8n-neonai.duckdns.org/studypals/';

-- Athlete Edge knowledge base: practical, food-first sports nutrition for young athletes.
INSERT INTO ys_knowledge (id,agent_id,title,category,content,tags,updated_by) VALUES
 ('ae-timing','agent-athlete','Meal timing around training and games','Timing',
  'Rule of thumb for young athletes: a full meal 3 to 4 hours before activity (carbohydrate + lean protein + some fat + fluids), a light carbohydrate snack 30 to 60 minutes before (banana, toast with jam, a small granola bar, crackers), water during activity that lasts under 60 minutes, and a recovery snack within 30 to 60 minutes after (carbohydrate + protein, e.g. chocolate milk, yogurt with fruit, a sandwich). Follow the recovery snack with a normal balanced meal within 2 hours. Avoid trying new foods on game day.',
  '["timing","pre-game","post-game","recovery"]','seed'),
 ('ae-hydration','agent-athlete','Hydration for youth sport','Hydration',
  'Drink water regularly all day, not only during sport. Guide: about 400 to 600 ml (2 to 3 cups) in the 2 hours before activity, sips every 15 to 20 minutes during activity (roughly 150 to 250 ml), and drink to replace losses afterwards until urine is pale yellow. Sports drinks with electrolytes are only useful for sessions longer than 60 to 90 minutes, tournaments with several games, or very hot and humid weather. Energy drinks and caffeine are not appropriate for children and teenagers.',
  '["hydration","water","electrolytes","heat"]','seed'),
 ('ae-plate','agent-athlete','The athlete plate','Everyday eating',
  'Training day plate: half the plate carbohydrates (rice, pasta, potatoes, bread, oats, fruit) because they fuel muscles, a quarter lean protein (chicken, fish, eggs, beans, lentils, paneer, tofu, dairy) for growth and repair, a quarter vegetables and fruit for vitamins and minerals, plus a small amount of healthy fat (nuts, seeds, avocado, olive oil) and calcium-rich foods for growing bones. Light or rest days: shift to a third carbohydrates and more vegetables. Growing athletes need more energy than adults of the same size; three meals plus two or three snacks is normal.',
  '["plate","carbohydrates","protein","balance"]','seed'),
 ('ae-endurance','agent-athlete','Endurance and field sports (soccer, hockey, basketball, cross-country, swimming)','By sport',
  'Long or repeated-sprint sports drain carbohydrate stores. Eat a carbohydrate-rich meal the night before and 3 to 4 hours before (pasta with tomato sauce and chicken, rice bowl, oatmeal with fruit). Top up with an easy snack 30 to 60 minutes before. For matches, tournaments or sessions over 60 to 90 minutes, take carbohydrate during play: orange slices, a banana, dried fruit, or a sports drink at half time. Recover with carbohydrate and protein within an hour, then a full meal.',
  '["soccer","football","hockey","basketball","swimming","running","endurance"]','seed'),
 ('ae-strength','agent-athlete','Strength, power and skill sports (gymnastics, athletics, tennis, martial arts, cricket)','By sport',
  'Skill and power sports need steady energy and adequate protein spread across the day (each meal and snack should contain some protein). Pre-session: a light carbohydrate and protein snack 1 to 2 hours before (yogurt and fruit, peanut butter toast, a small sandwich). Afterwards, protein plus carbohydrate within the hour (milk, eggs on toast, dal and rice, a chicken wrap). Young athletes do not need protein powders; food covers their needs. Weight-category sports: never cut water or skip meals to make weight; talk to a coach, parent and a sports dietitian.',
  '["gymnastics","tennis","athletics","martial arts","cricket","strength","protein"]','seed'),
 ('ae-tournament','agent-athlete','Tournament and multi-game days','Timing',
  'When games are close together, eat small and often. Between games under 1 hour apart: fluids, fruit, crackers, a small sandwich half. Between games 1 to 2 hours apart: a light meal such as a turkey or paneer sandwich, rice with vegetables, or yogurt with granola and fruit. Pack a cooler: water, diluted juice, bananas, grapes, cut fruit, sandwiches, pretzels, cheese sticks, plain popcorn, homemade trail mix. Avoid heavy fried food, large portions and fizzy drinks between games.',
  '["tournament","snacks","pack list"]','seed'),
 ('ae-breakfast','agent-athlete','Early morning training','Timing',
  'For early sessions when a full meal is not possible: have something small and easy 30 to 60 minutes before, such as a banana, toast with honey, a small bowl of cereal with milk, or a smoothie. Eat a proper breakfast straight after training (eggs and toast, oats with milk and fruit, idli or dosa with sambar, a bagel with peanut butter). If nothing before training is tolerated, eat a carbohydrate-rich dinner and a bedtime snack the night before and take water to the session.',
  '["breakfast","morning","early"]','seed'),
 ('ae-safety','agent-athlete','What Athlete Edge does not do','Safety',
  'Athlete Edge gives general food-first guidance for healthy young athletes. It does not diagnose or treat medical conditions, does not recommend supplements, weight loss diets, fasting, calorie counting or protein powders for children or teenagers, and does not replace a doctor, registered dietitian or the athlete parents and coaches. Signs that need a professional: unexplained weight loss, fainting, dizziness, missed periods, stomach problems that keep coming back, allergies, diabetes, or any worry about eating habits. Ask a parent or guardian to be part of the conversation for athletes under 16.',
  '["safety","supplements","dietitian"]','seed'),
 ('ae-vegetarian','agent-athlete','Vegetarian, vegan and cultural diets','Everyday eating',
  'Vegetarian young athletes get enough protein from dairy, eggs, paneer, tofu, beans, lentils, chickpeas, peas, nuts and seeds; combine legumes with rice or bread across the day. Watch iron (lentils, beans, spinach, fortified cereal with a vitamin C food such as orange or tomato), calcium (milk, yogurt, fortified plant milks, sesame), vitamin B12 (dairy, eggs or fortified foods; vegans should ask a doctor about B12) and vitamin D. Halal, kosher, Jain and other food rules fit perfectly well into an athlete plan; the timing and portion rules do not change.',
  '["vegetarian","vegan","halal","iron","calcium"]','seed'),
 ('ae-allergies','agent-athlete','Allergies and intolerances','Safety',
  'Always respect the allergies written in the athlete profile and never suggest a food that contains them. Common swaps: dairy-free recovery drink = soy milk with banana; nut-free trail mix = seeds, dried fruit, pretzels; gluten-free pre-game carbohydrates = rice, potatoes, corn tortillas, gluten-free oats, fruit. Coeliac disease, diabetes and severe allergies need a plan agreed with the family doctor or dietitian.',
  '["allergy","gluten","dairy","nuts"]','seed'),
 -- Event Planner playbook
 ('ev-phases','agent-events','Event planning phases and timeline','Playbook',
  'Plan backwards from the event date. 6 to 8 weeks out: goal, date, budget, venue booked, core team and roles. 4 weeks out: program agreed, vendors (food, sound, decoration) confirmed, invitations and RSVP link sent, permits if needed. 2 weeks out: reminder to invitees, volunteer roster, run-of-show, equipment list, transport and parking plan. 1 week out: final headcount to caterer, print materials, confirm every vendor by phone, share the schedule and venue map with everyone. Day before: setup plan, signage, contact list, emergency contacts, cash float. Event day: check-in desk, timekeeper, photo, cleanup crew. After: thank-you message, expenses reconciled, feedback and lessons learned.',
  '["timeline","checklist","phases"]','seed'),
 ('ev-roles','agent-events','Roles for a small organising team','Playbook',
  'Assign one owner per area so nothing falls between people: Lead organiser (decisions, budget), Venue and logistics (booking, layout, tables, power, parking, permits), Food and drink (menu, quantities, dietary needs, serving plan), Communications (invitations, RSVPs, reminders, announcements, the single information channel), Program and entertainment (run-of-show, MC, sound, activities), Finance (collect contributions, pay vendors, receipts), Volunteers and setup/cleanup. For an event of 50 to 100 people plan 1 helper per 15 to 20 guests.',
  '["roles","team","volunteers"]','seed'),
 ('ev-comms','agent-events','One place for information instead of WhatsApp threads','Communication',
  'Keep every announcement, schedule change, venue map, packing list and contact in the event Updates so nobody has to scroll a chat. Post short updates with a clear title, the date and what people need to do. Pin the essentials: date and time, venue and map link, what to bring, who to contact. Use the event chat for questions and coordination, and answer questions by adding the answer to an Update so it is found later. Send a reminder 1 week before, 1 day before and on the morning of the event. Ask for RSVPs with a deadline and party size so food and seating can be planned.',
  '["communication","announcements","rsvp","whatsapp"]','seed'),
 ('ev-food','agent-events','Food and drink quantities','Logistics',
  'Rough quantities for a buffet: 450 to 550 g of total food per adult, half for children. Rice or pasta 80 to 100 g dry per person, curry or main protein 150 to 200 g per person, salad 80 g, bread 1 to 2 pieces, dessert 1 portion plus 10 percent extra. Drinks: 1 litre of water per person for a 3 to 4 hour event plus 2 to 3 cups of other drinks; double the water for outdoor summer events. Always ask about vegetarian, vegan, halal, gluten-free and nut allergies in the RSVP and label every dish. Confirm the final headcount with the caterer 5 to 7 days before.',
  '["food","catering","quantities","dietary"]','seed'),
 ('ev-budget','agent-events','Budget structure','Logistics',
  'Typical split for a community or family event: venue 20 to 30 percent, food and drink 35 to 45 percent, decoration and printing 5 to 10 percent, sound, lights and entertainment 10 to 15 percent, contingency 10 percent. Track every cost as a task with an owner, an estimate and the actual amount. Collect contributions with a deadline and publish a simple summary so everyone trusts the numbers.',
  '["budget","costs","contributions"]','seed'),
 ('ev-dayof','agent-events','Run-of-show and event day','Playbook',
  'Write a run-of-show with times, what happens, who is responsible and what equipment is needed for each block; share it the day before. Arrive 2 hours early for setup, do a sound and power check, put up signage and a welcome desk with the RSVP list. Keep a printed contact list of vendors, helpers and venue staff, and a small first-aid kit. Assign a timekeeper and a photographer. Plan cleanup and who takes leftovers before the event starts. Post a thank-you and photos within 24 hours.',
  '["run of show","event day","setup"]','seed'),
 ('ev-sports','agent-events','Sports tournaments and school events','By event type',
  'Sports day or tournament: fixtures and pitch or court allocation, referees or umpires, first aid, water stations and shade, team check-in, results board and a hydration and snack table (fruit, water). School or cultural program: rehearsal schedule, stage plan, sound and microphones, seating for families, parking and drop-off, photo consent. Family celebrations: guest list with party sizes, kids activities, dietary needs, gifts and thank-you list.',
  '["sports","school","cultural","family"]','seed')
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, category=EXCLUDED.category, content=EXCLUDED.content, tags=EXCLUDED.tags;

-- A sample event owned by the admin so the Events area is not empty on first login.
INSERT INTO ys_events (id,code,title,type,description,starts_at,ends_at,venue,address,owner_id,owner_name,status,budget,expected_guests)
SELECT 'EV-DEMO01','YSQ001','Community Sports Day','sports','Annual family sports day with a 5-a-side tournament, kids races and a shared lunch.',
 (current_date + 21) + time '09:00', (current_date + 21) + time '15:00','Riverside Park','Riverside Park, Main Field','user-raju','Raju','planning',2500,120
WHERE NOT EXISTS (SELECT 1 FROM ys_events WHERE id='EV-DEMO01');
INSERT INTO ys_event_members (event_id,member_id,name,role,rsvp,party_size) VALUES ('EV-DEMO01','user-raju','Raju','organizer','yes',1) ON CONFLICT DO NOTHING;
INSERT INTO ys_event_tasks (id,event_id,title,category,assignee,due_at,status,priority,created_by) VALUES
 ('TK-DEMO01','EV-DEMO01','Confirm park permit and field booking','venue','Raju',current_date + 7,'doing','high','seed'),
 ('TK-DEMO02','EV-DEMO01','Order lunch: 120 boxes, 30 vegetarian, 10 gluten-free','food',NULL,current_date + 14,'todo','high','seed'),
 ('TK-DEMO03','EV-DEMO01','Send RSVP reminder with party size and dietary needs','comms',NULL,current_date + 5,'todo','normal','seed'),
 ('TK-DEMO04','EV-DEMO01','Book first-aid volunteer and water station','logistics',NULL,current_date + 10,'todo','normal','seed'),
 ('TK-DEMO05','EV-DEMO01','Draw 5-a-side fixtures and referee roster','program',NULL,current_date + 12,'todo','normal','seed')
ON CONFLICT (id) DO NOTHING;
INSERT INTO ys_event_updates (id,event_id,kind,title,body,pinned,author) VALUES
 ('UP-DEMO01','EV-DEMO01','info','Venue and timing','Riverside Park, Main Field. Gates open 8:30, first game 9:30, lunch 12:30, prizes 14:30. Parking at the north lot.',true,'Raju'),
 ('UP-DEMO02','EV-DEMO01','announcement','RSVP by next Friday','Please reply with the number of adults and children and any dietary needs so we can order lunch.',false,'Raju')
ON CONFLICT (id) DO NOTHING;
INSERT INTO ys_event_messages (event_id,author_id,author,body) SELECT 'EV-DEMO01','user-raju','Raju','Welcome to the Sports Day planning space. Questions here, everything important goes into Updates.' WHERE NOT EXISTS (SELECT 1 FROM ys_event_messages WHERE event_id='EV-DEMO01');

INSERT INTO ys_activity (actor,actor_type,action,object_type,target,icon) SELECT 'Y Square','system','provisioned','database','Y Square schema and seed data','db' WHERE NOT EXISTS (SELECT 1 FROM ys_activity WHERE action='provisioned' AND object_type='database');
