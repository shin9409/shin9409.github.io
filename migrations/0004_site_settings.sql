CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    hero_eyebrow TEXT NOT NULL DEFAULT '',
    hero_title TEXT NOT NULL DEFAULT '',
    hero_subtitle TEXT NOT NULL DEFAULT '',
    hero_work_ids TEXT NOT NULL DEFAULT '[]',
    intro_title TEXT NOT NULL DEFAULT '',
    intro_body TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '',
    contact_address TEXT NOT NULL DEFAULT '',
    instagram_url TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings (
    id,
    hero_eyebrow,
    hero_title,
    hero_subtitle,
    hero_work_ids,
    intro_title,
    intro_body,
    contact_email,
    contact_phone,
    contact_address,
    instagram_url
) VALUES (
    1,
    'LOOKUP MEDIA / SEOUL',
    replace('PRODUCTION|& LIGHTING', '|', char(10)),
    'FILM · MUSIC VIDEO · COMMERCIAL',
    '["work002","work003"]',
    'EVERY FRAME BEGINS WITH A CLEAR POINT OF VIEW.',
    'LOOKUP MEDIA는 아이디어에서 현장, 마지막 프레임까지 하나의 시선으로 연결합니다. 프로덕션과 조명을 통해 이야기의 가장 정확한 분위기를 만듭니다.',
    'lookupmedia@naver.com',
    '010-2433-0583',
    '경기도 고양시 덕양구 지축4로 45 101,102호',
    'https://www.instagram.com/lookupmedia_'
);
