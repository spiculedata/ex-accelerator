-- Language Detection Schema for DuckDB
-- Extends the base dashboard schema with language detection specific tables
-- Supports multi-language content analysis, confidence scoring, and temporal trends

-- Language definitions and metadata
CREATE TABLE languages (
    id INTEGER PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE, -- ISO 639-1 language codes (en, es, fr, etc.)
    name VARCHAR(100) NOT NULL, -- Full language name (English, Spanish, French, etc.)
    native_name VARCHAR(100), -- Language name in its native script
    script VARCHAR(50), -- Writing system (Latin, Cyrillic, Arabic, etc.)
    direction VARCHAR(10) DEFAULT 'ltr', -- Text direction (ltr, rtl)
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Language detection results for individual posts
CREATE TABLE language_detection (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    language_id INTEGER REFERENCES languages(id),
    confidence_score DECIMAL(4,3) NOT NULL, -- 0.000 to 1.000
    detection_model VARCHAR(50) DEFAULT 'langdetect', -- AI model used for detection
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alternative language candidates for posts (when detection is uncertain)
CREATE TABLE language_candidates (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    language_id INTEGER REFERENCES languages(id),
    confidence_score DECIMAL(4,3) NOT NULL,
    rank INTEGER NOT NULL, -- 1 = primary, 2 = secondary, etc.
    detection_model VARCHAR(50) DEFAULT 'langdetect',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Language distribution trends over time
CREATE TABLE language_trends (
    id INTEGER PRIMARY KEY,
    language_id INTEGER REFERENCES languages(id),
    data_source_id INTEGER REFERENCES data_sources(id),
    analysis_date DATE NOT NULL,
    post_count INTEGER DEFAULT 0,
    avg_confidence DECIMAL(4,3),
    total_characters INTEGER DEFAULT 0,
    total_words INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language_id, data_source_id, analysis_date)
);

-- Language pairs and code-switching detection
CREATE TABLE language_mixing (
    id INTEGER PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    primary_language_id INTEGER REFERENCES languages(id),
    secondary_language_id INTEGER REFERENCES languages(id),
    mixing_type VARCHAR(20) DEFAULT 'code-switching', -- code-switching, borrowing, transliteration
    primary_confidence DECIMAL(4,3),
    secondary_confidence DECIMAL(4,3),
    segment_count INTEGER DEFAULT 1, -- Number of language segments in post
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geographic language distribution
CREATE TABLE language_geography (
    id INTEGER PRIMARY KEY,
    language_id INTEGER REFERENCES languages(id),
    country_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2 country codes
    region VARCHAR(100),
    post_count INTEGER DEFAULT 0,
    percentage DECIMAL(5,2) DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language_id, country_code)
);

-- Insert supported languages
INSERT INTO languages (id, code, name, native_name, script, direction) VALUES
(1, 'en', 'English', 'English', 'Latin', 'ltr'),
(2, 'es', 'Spanish', 'Español', 'Latin', 'ltr'),
(3, 'fr', 'French', 'Français', 'Latin', 'ltr'),
(4, 'de', 'German', 'Deutsch', 'Latin', 'ltr'),
(5, 'pt', 'Portuguese', 'Português', 'Latin', 'ltr'),
(6, 'it', 'Italian', 'Italiano', 'Latin', 'ltr'),
(7, 'ja', 'Japanese', '日本語', 'Hiragana/Katakana/Kanji', 'ltr'),
(8, 'ko', 'Korean', '한국어', 'Hangul', 'ltr'),
(9, 'zh', 'Chinese', '中文', 'Chinese', 'ltr'),
(10, 'ar', 'Arabic', 'العربية', 'Arabic', 'rtl'),
(11, 'ru', 'Russian', 'Русский', 'Cyrillic', 'ltr'),
(12, 'hi', 'Hindi', 'हिन्दी', 'Devanagari', 'ltr'),
(13, 'nl', 'Dutch', 'Nederlands', 'Latin', 'ltr'),
(14, 'sv', 'Swedish', 'Svenska', 'Latin', 'ltr'),
(15, 'da', 'Danish', 'Dansk', 'Latin', 'ltr'),
(16, 'no', 'Norwegian', 'Norsk', 'Latin', 'ltr'),
(17, 'fi', 'Finnish', 'Suomi', 'Latin', 'ltr'),
(18, 'pl', 'Polish', 'Polski', 'Latin', 'ltr'),
(19, 'tr', 'Turkish', 'Türkçe', 'Latin', 'ltr'),
(20, 'he', 'Hebrew', 'עברית', 'Hebrew', 'rtl');

-- Sample language detection data
INSERT INTO language_detection (id, post_id, language_id, confidence_score, detection_model)
WITH post_sample AS (
    SELECT generate_series as post_id
    FROM generate_series(1, 30000)
),
language_distribution AS (
    SELECT 
        post_id,
        CASE 
            WHEN random() < 0.672 THEN 1  -- English 67.2%
            WHEN random() < 0.805 THEN 2  -- Spanish 13.3%
            WHEN random() < 0.872 THEN 3  -- French 6.7%
            WHEN random() < 0.920 THEN 4  -- German 4.8%
            WHEN random() < 0.952 THEN 5  -- Portuguese 3.2%
            WHEN random() < 0.975 THEN 6  -- Italian 2.3%
            WHEN random() < 0.990 THEN 7  -- Japanese 1.5%
            ELSE 8                        -- Korean 1.0%
        END as language_id,
        (0.70 + random() * 0.30)::DECIMAL(4,3) as confidence_score
    FROM post_sample
)
SELECT 
    row_number() OVER () as id,
    post_id,
    language_id,
    confidence_score,
    'langdetect'
FROM language_distribution;

-- Sample language candidates (alternative detections)
INSERT INTO language_candidates (id, post_id, language_id, confidence_score, rank)
WITH uncertain_posts AS (
    SELECT ld.post_id, ld.language_id as primary_lang, ld.confidence_score as primary_conf
    FROM language_detection ld
    WHERE ld.confidence_score < 0.85 -- Only posts with uncertain detection
    AND random() < 0.3 -- 30% of uncertain posts have alternatives
),
secondary_candidates AS (
    SELECT 
        up.post_id,
        CASE 
            WHEN up.primary_lang = 1 THEN 2  -- English -> Spanish
            WHEN up.primary_lang = 2 THEN 1  -- Spanish -> English
            WHEN up.primary_lang = 3 THEN 1  -- French -> English
            WHEN up.primary_lang = 4 THEN 1  -- German -> English
            WHEN up.primary_lang = 5 THEN 2  -- Portuguese -> Spanish
            WHEN up.primary_lang = 6 THEN 3  -- Italian -> French
            ELSE 1                           -- Default to English
        END as language_id,
        (up.primary_conf - 0.10 - random() * 0.20)::DECIMAL(4,3) as confidence_score,
        2 as rank
    FROM uncertain_posts up
)
SELECT 
    row_number() OVER () as id,
    post_id,
    language_id,
    GREATEST(0.100, confidence_score) as confidence_score,
    rank
FROM secondary_candidates;

-- Sample language trends (last 30 days)
INSERT INTO language_trends (id, language_id, data_source_id, analysis_date, post_count, avg_confidence, total_characters, total_words)
WITH date_range AS (
    SELECT CURRENT_DATE - INTERVAL (generate_series) DAY as analysis_date
    FROM generate_series(0, 29)
),
language_list AS (
    SELECT id as language_id FROM languages WHERE id <= 8 -- Top 8 languages
),
source_list AS (
    SELECT generate_series as data_source_id
    FROM generate_series(1, 7) -- 7 data sources
)
SELECT 
    row_number() OVER () as id,
    ll.language_id,
    sl.data_source_id,
    dr.analysis_date,
    (CASE ll.language_id
        WHEN 1 THEN 800 + random() * 200  -- English
        WHEN 2 THEN 150 + random() * 50   -- Spanish
        WHEN 3 THEN 75 + random() * 25    -- French
        WHEN 4 THEN 55 + random() * 20    -- German
        WHEN 5 THEN 35 + random() * 15    -- Portuguese
        WHEN 6 THEN 25 + random() * 10    -- Italian
        WHEN 7 THEN 15 + random() * 8     -- Japanese
        ELSE 10 + random() * 5             -- Korean
    END)::INTEGER as post_count,
    (0.75 + random() * 0.20)::DECIMAL(4,3) as avg_confidence,
    (5000 + random() * 2000)::INTEGER as total_characters,
    (800 + random() * 300)::INTEGER as total_words
FROM date_range dr
CROSS JOIN language_list ll
CROSS JOIN source_list sl;

-- Sample language mixing data (code-switching)
INSERT INTO language_mixing (id, post_id, primary_language_id, secondary_language_id, mixing_type, primary_confidence, secondary_confidence, segment_count)
WITH mixing_posts AS (
    SELECT 
        (1 + random() * 30000)::INTEGER as post_id,
        CASE 
            WHEN random() < 0.5 THEN 1 ELSE 2 -- English-Spanish mixing most common
        END as primary_language_id,
        CASE 
            WHEN random() < 0.5 THEN 2 ELSE 1 -- Spanish-English mixing
        END as secondary_language_id,
        CASE 
            WHEN random() < 0.7 THEN 'code-switching'
            WHEN random() < 0.9 THEN 'borrowing'
            ELSE 'transliteration'
        END as mixing_type,
        (0.60 + random() * 0.25)::DECIMAL(4,3) as primary_confidence,
        (0.40 + random() * 0.30)::DECIMAL(4,3) as secondary_confidence,
        (2 + random() * 3)::INTEGER as segment_count
    FROM generate_series(1, 500) -- 500 posts with language mixing
)
SELECT 
    row_number() OVER () as id,
    post_id,
    primary_language_id,
    secondary_language_id,
    mixing_type,
    primary_confidence,
    secondary_confidence,
    segment_count
FROM mixing_posts;

-- Sample geographic distribution
INSERT INTO language_geography (id, language_id, country_code, region, post_count, percentage)
VALUES
-- English
(1, 1, 'US', 'North America', 15420, 34.1),
(2, 1, 'GB', 'Europe', 8930, 19.7),
(3, 1, 'CA', 'North America', 4560, 10.1),
(4, 1, 'AU', 'Oceania', 3210, 7.1),
(5, 1, 'IN', 'Asia', 2890, 6.4),

-- Spanish
(6, 2, 'MX', 'North America', 3420, 38.2),
(7, 2, 'ES', 'Europe', 2130, 23.8),
(8, 2, 'AR', 'South America', 1560, 17.4),
(9, 2, 'CO', 'South America', 980, 11.0),
(10, 2, 'US', 'North America', 855, 9.6),

-- French
(11, 3, 'FR', 'Europe', 2340, 51.8),
(12, 3, 'CA', 'North America', 1230, 27.2),
(13, 3, 'BE', 'Europe', 560, 12.4),
(14, 3, 'CH', 'Europe', 391, 8.6),

-- German
(15, 4, 'DE', 'Europe', 1890, 58.9),
(16, 4, 'AT', 'Europe', 670, 20.9),
(17, 4, 'CH', 'Europe', 480, 15.0),
(18, 4, 'LU', 'Europe', 170, 5.2),

-- Portuguese
(19, 5, 'BR', 'South America', 1560, 73.1),
(20, 5, 'PT', 'Europe', 453, 21.2),
(21, 5, 'AO', 'Africa', 121, 5.7),

-- Italian
(22, 6, 'IT', 'Europe', 1234, 78.7),
(23, 6, 'CH', 'Europe', 234, 14.9),
(24, 6, 'SM', 'Europe', 99, 6.4),

-- Japanese
(25, 7, 'JP', 'Asia', 890, 90.2),
(26, 7, 'US', 'North America', 67, 6.8),
(27, 7, 'BR', 'South America', 30, 3.0),

-- Korean
(28, 8, 'KR', 'Asia', 567, 83.6),
(29, 8, 'US', 'North America', 78, 11.5),
(30, 8, 'CN', 'Asia', 33, 4.9);

-- Analytical views for language detection

-- Language overview statistics
CREATE VIEW language_overview AS
SELECT 
    l.code,
    l.name,
    l.native_name,
    COUNT(ld.id) as post_count,
    ROUND(COUNT(ld.id) * 100.0 / (SELECT COUNT(*) FROM language_detection), 2) as percentage,
    AVG(ld.confidence_score) as avg_confidence,
    MIN(ld.confidence_score) as min_confidence,
    MAX(ld.confidence_score) as max_confidence,
    COUNT(CASE WHEN ld.confidence_score >= 0.9 THEN 1 END) as high_confidence_count,
    COUNT(CASE WHEN ld.confidence_score < 0.8 THEN 1 END) as low_confidence_count
FROM languages l
LEFT JOIN language_detection ld ON l.id = ld.language_id
GROUP BY l.id, l.code, l.name, l.native_name
HAVING COUNT(ld.id) > 0
ORDER BY post_count DESC;

-- Daily language trends
CREATE VIEW daily_language_trends AS
SELECT 
    lt.analysis_date,
    l.code,
    l.name,
    SUM(lt.post_count) as total_posts,
    AVG(lt.avg_confidence) as avg_confidence,
    SUM(lt.total_characters) as total_characters,
    SUM(lt.total_words) as total_words
FROM language_trends lt
JOIN languages l ON lt.language_id = l.id
GROUP BY lt.analysis_date, l.code, l.name
ORDER BY lt.analysis_date DESC, total_posts DESC;

-- Posts with language detection
CREATE VIEW posts_with_language AS
SELECT 
    p.id,
    p.content,
    p.author,
    p.created_at,
    ds.name as platform,
    l.code as language_code,
    l.name as language_name,
    ld.confidence_score,
    ld.detection_model,
    -- Secondary language if exists
    l2.code as secondary_language_code,
    l2.name as secondary_language_name,
    lc.confidence_score as secondary_confidence
FROM posts p
JOIN data_sources ds ON p.data_source_id = ds.id
LEFT JOIN language_detection ld ON p.id = ld.post_id
LEFT JOIN languages l ON ld.language_id = l.id
LEFT JOIN language_candidates lc ON p.id = lc.post_id AND lc.rank = 2
LEFT JOIN languages l2 ON lc.language_id = l2.id
ORDER BY p.created_at DESC;

-- Language mixing analysis
CREATE VIEW language_mixing_analysis AS
SELECT 
    l1.name as primary_language,
    l2.name as secondary_language,
    lm.mixing_type,
    COUNT(*) as occurrence_count,
    AVG(lm.primary_confidence) as avg_primary_confidence,
    AVG(lm.secondary_confidence) as avg_secondary_confidence,
    AVG(lm.segment_count) as avg_segments
FROM language_mixing lm
JOIN languages l1 ON lm.primary_language_id = l1.id
JOIN languages l2 ON lm.secondary_language_id = l2.id
GROUP BY l1.name, l2.name, lm.mixing_type
ORDER BY occurrence_count DESC;

-- Geographic language distribution
CREATE VIEW language_geographic_distribution AS
SELECT 
    l.name as language_name,
    lg.country_code,
    lg.region,
    lg.post_count,
    lg.percentage,
    RANK() OVER (PARTITION BY l.id ORDER BY lg.post_count DESC) as country_rank
FROM language_geography lg
JOIN languages l ON lg.language_id = l.id
ORDER BY l.name, lg.post_count DESC;

-- Language confidence analysis
CREATE VIEW language_confidence_analysis AS
SELECT 
    l.name as language_name,
    COUNT(ld.id) as total_detections,
    COUNT(CASE WHEN ld.confidence_score >= 0.95 THEN 1 END) as very_high_confidence,
    COUNT(CASE WHEN ld.confidence_score >= 0.90 AND ld.confidence_score < 0.95 THEN 1 END) as high_confidence,
    COUNT(CASE WHEN ld.confidence_score >= 0.80 AND ld.confidence_score < 0.90 THEN 1 END) as medium_confidence,
    COUNT(CASE WHEN ld.confidence_score < 0.80 THEN 1 END) as low_confidence,
    AVG(ld.confidence_score) as avg_confidence,
    STDDEV(ld.confidence_score) as confidence_stddev
FROM languages l
JOIN language_detection ld ON l.id = ld.language_id
GROUP BY l.id, l.name
ORDER BY total_detections DESC;