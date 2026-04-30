-- ============================================================
-- Planner App - Supabase Schema
-- Supabase SQL Editor'ünde (veya Dashboard > SQL) çalıştırın
-- ============================================================

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Todos
CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo',
  priority INTEGER DEFAULT 1,
  due_date TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Project work sessions
CREATE TABLE IF NOT EXISTS project_sessions (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_minutes INTEGER DEFAULT 0
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE
);

-- Todo <-> Tag junction
CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id BIGINT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id  BIGINT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

-- Subtasks
CREATE TABLE IF NOT EXISTS subtasks (
  id BIGSERIAL PRIMARY KEY,
  todo_id BIGINT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed SMALLINT DEFAULT 0,
  position INTEGER DEFAULT 0
);

-- ============================================================
-- Tüm tablolara anon erişim için RLS politikaları
-- (Tek kullanıcılı masaüstü uygulama - auth yok)
-- ============================================================
ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_projects"         ON projects         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_todos"            ON todos            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_settings"         ON settings         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_project_sessions" ON project_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_tags"             ON tags             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_todo_tags"        ON todo_tags        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_subtasks"         ON subtasks         FOR ALL TO anon USING (true) WITH CHECK (true);

-- Sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
