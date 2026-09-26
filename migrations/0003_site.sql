-- Website editor: permission flag + editable content (photos are free Unsplash images; replace them from Admin → Website)
ALTER TABLE users ADD COLUMN can_edit_site INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO settings (key, value) VALUES ('favicon_key', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('seo_description', 'Ronia Logistics, Abuja: same-day, interstate and international deliveries, warehousing for vendors and live package tracking.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_badge', 'Abuja • Nationwide • International');
INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_media_type', 'image');
INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_image', 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=2000&q=70');
INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_video', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_cta_label', 'Book a delivery');
INSERT OR IGNORE INTO settings (key, value) VALUES ('stats_json', '[{"value": "Same day", "label": "Delivery within Abuja"}, {"value": "36 + FCT", "label": "States we deliver to"}, {"value": "24/7", "label": "Online package tracking"}, {"value": "Secure", "label": "Warehousing for vendors"}]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('services_title', 'What we do');
INSERT OR IGNORE INTO settings (key, value) VALUES ('services_subtitle', 'From a small parcel across Abuja to full warehousing and delivery for your online store.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('services_json', '[{"title": "Same-day delivery", "description": "Dispatch riders pick up and deliver anywhere in Abuja the same day.", "image": "https://images.unsplash.com/photo-1625640039753-48643d839b94?auto=format&fit=crop&w=900&q=70"}, {"title": "Interstate delivery", "description": "Safe, trackable delivery to every state in Nigeria by road.", "image": "https://images.unsplash.com/photo-1616432043562-3671ea2e5242?auto=format&fit=crop&w=900&q=70"}, {"title": "Express parcels", "description": "Priority handling and the fastest route for urgent packages.", "image": "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=900&q=70"}, {"title": "International shipping", "description": "Send documents and parcels abroad with door-to-door tracking.", "image": "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=900&q=70"}, {"title": "Warehousing & fulfilment", "description": "Vendors store stock with us; we pack, deliver and account for every item.", "image": "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=900&q=70"}, {"title": "Cash on delivery", "description": "We collect payment from your customers and pay you promptly.", "image": "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=900&q=70"}]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('steps_title', 'How it works');
INSERT OR IGNORE INTO settings (key, value) VALUES ('steps_json', '[{"title": "Drop off or book a pickup", "description": "Bring your package to our Abuja office or call us to pick it up."}, {"title": "Get your tracking number", "description": "We register it and give you a printed receipt with your tracking number."}, {"title": "Follow every step", "description": "Track online any time: in transit, at hub, out for delivery."}, {"title": "Delivered", "description": "Your receiver gets it and you get a delivery confirmation."}]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('about_title', 'About Ronia Logistics');
INSERT OR IGNORE INTO settings (key, value) VALUES ('about_body', 'Ronia Logistics is an Abuja-based logistics company offering same-day, interstate and international deliveries, plus secure warehousing and order fulfilment for vendors.

Every package is registered, tracked and handled by named staff, so you always know where it is and who has it.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('about_image', 'https://images.unsplash.com/photo-1586528116022-aeda1613c63d?auto=format&fit=crop&w=1200&q=70');
INSERT OR IGNORE INTO settings (key, value) VALUES ('about_points_json', '["Every package tracked from drop-off to delivery", "Trained, accountable staff and riders", "Printed receipts and proof of delivery", "Transparent pricing, no hidden charges"]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_title', 'Vendors: store with us, sell more');
INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_body', 'Keep your stock in our warehouse. We pack, deliver and collect payment, and you see every sale and every item that leaves, live on your own merchant dashboard.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('merchant_image', 'https://images.unsplash.com/photo-1627309366653-2dedc084cdf1?auto=format&fit=crop&w=1200&q=70');
INSERT OR IGNORE INTO settings (key, value) VALUES ('gallery_title', 'On the move');
INSERT OR IGNORE INTO settings (key, value) VALUES ('gallery_json', '["https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=900&q=70", "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=70", "https://images.unsplash.com/photo-1473445730015-841f29a9490b?auto=format&fit=crop&w=900&q=70", "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=900&q=70", "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=900&q=70", "https://images.unsplash.com/photo-1591768793355-74d04bb6608f?auto=format&fit=crop&w=900&q=70"]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('faq_json', '[{"q": "How do I track my package?", "a": "Enter the tracking number on your receipt in the Track box on our website. You do not need an account."}, {"q": "How long does interstate delivery take?", "a": "Most interstate deliveries arrive within 1 to 3 working days, depending on the destination."}, {"q": "Can I pay online?", "a": "Yes. If your shipping fee is unpaid, the tracking page lets you pay by card, transfer or USSD."}, {"q": "How do I become a merchant?", "a": "Click Merchant login, then Apply. Our team reviews every application before activating the account."}]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('cta_title', 'Ready to send a package?');
INSERT OR IGNORE INTO settings (key, value) VALUES ('cta_body', 'Visit our Abuja office or call us for a pickup. We will handle the rest.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('office_hours', 'Mon – Sat: 8:00am – 6:00pm');
INSERT OR IGNORE INTO settings (key, value) VALUES ('map_query', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('facebook', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('instagram', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('x_twitter', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tiktok', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('linkedin', '');
