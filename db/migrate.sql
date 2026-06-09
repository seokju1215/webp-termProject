-- 기존 DB에서 새 스키마로 마이그레이션
-- 실행: psql -d qa_platform -f db/migrate.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_status') THEN
    CREATE TYPE comment_status AS ENUM ('IN_PROGRESS', 'DONE', 'FAILED');
  END IF;
END $$;

-- projects: 대표 이미지 추가
ALTER TABLE projects ADD COLUMN IF NOT EXISTS image_url TEXT;

-- comments: 구조 변경
ALTER TABLE comments ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS assignee_id   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS status        comment_status NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS page_url      TEXT;
ALTER TABLE comments DROP COLUMN IF EXISTS image_url;
ALTER TABLE comments ALTER COLUMN test_case_id DROP NOT NULL;
ALTER TABLE comments ALTER COLUMN created_by_id DROP NOT NULL;

-- project_id 백필 (test_case 경유)
UPDATE comments c
SET project_id = tc.project_id
FROM test_cases tc
WHERE c.test_case_id = tc.id AND c.project_id IS NULL;

-- project_id NOT NULL 제약 추가 (백필 후)
-- 고아 댓글이 없을 경우에만 실행
-- ALTER TABLE comments ALTER COLUMN project_id SET NOT NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_comments_project_id   ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_assignee_id  ON comments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_status       ON comments(status);

-- Google OAuth
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
