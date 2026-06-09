-- QA 협업 플랫폼 스키마
-- 신규: psql -d qa_platform -f db/schema.sql
-- 기존 DB 마이그레이션: db/migrate.sql 참고

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM 타입
CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
CREATE TYPE testcase_status   AS ENUM ('IN_PROGRESS', 'DONE', 'FAILED');
CREATE TYPE comment_status    AS ENUM ('IN_PROGRESS', 'DONE', 'FAILED');

-- users
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  password    VARCHAR(255),
  google_id   VARCHAR(255) UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- teams
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- team_members
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- team_invitations
CREATE TABLE IF NOT EXISTS team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  token       VARCHAR(255) NOT NULL UNIQUE,
  status      invitation_status NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  url         TEXT NOT NULL,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- test_cases
CREATE TABLE IF NOT EXISTS test_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by_id   UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          testcase_status NOT NULL DEFAULT 'IN_PROGRESS',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- comments (Agentation webhook 수신 + 수동 생성 모두 지원)
CREATE TABLE IF NOT EXISTS comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_case_id    UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  created_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  content         TEXT NOT NULL,
  status          comment_status NOT NULL DEFAULT 'IN_PROGRESS',
  selector        VARCHAR(500),
  bounding_rect   JSONB,
  tag_name        VARCHAR(100),
  text_content    TEXT,
  page_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- mcp_api_keys
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by_id   UUID NOT NULL REFERENCES users(id),
  key             VARCHAR(255) NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_team_members_team_id    ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id    ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id        ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_project_id   ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_project_id     ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_test_case_id   ON comments(test_case_id);
CREATE INDEX IF NOT EXISTS idx_comments_assignee_id    ON comments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_by_id  ON comments(created_by_id);
CREATE INDEX IF NOT EXISTS idx_comments_page_url       ON comments(page_url);
CREATE INDEX IF NOT EXISTS idx_comments_status         ON comments(status);
