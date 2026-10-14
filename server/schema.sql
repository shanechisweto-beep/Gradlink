CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'company', 'admin')),
  name TEXT NOT NULL,
  school TEXT,
  location TEXT,
  study_field TEXT,
  track TEXT CHECK (track IS NULL OR track IN ('earning', 'interview')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget NUMERIC(12, 2) NOT NULL CHECK (budget > 0),
  payment TEXT NOT NULL CHECK (payment IN ('USD', 'EcoCash')),
  skill TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Entry level', 'Intermediate', 'Professional', 'Advanced')),
  deadline TEXT NOT NULL,
  applicants INTEGER NOT NULL DEFAULT 0 CHECK (applicants >= 0),
  match INTEGER NOT NULL DEFAULT 80 CHECK (match BETWEEN 0 AND 100),
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposal TEXT NOT NULL CHECK (char_length(btrim(proposal)) >= 20),
  delivery_days INTEGER NOT NULL CHECK (delivery_days BETWEEN 1 AND 30),
  portfolio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied', 'accepted', 'rejected', 'completed', 'interview-invited')),
  interview_invited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, student_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_policy (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  student_completed_tasks INTEGER NOT NULL DEFAULT 10 CHECK (student_completed_tasks > 0),
  company_filled_tasks INTEGER NOT NULL DEFAULT 10 CHECK (company_filled_tasks > 0),
  minimum_interview_invites INTEGER NOT NULL DEFAULT 5 CHECK (minimum_interview_invites > 0)
);

INSERT INTO interview_policy (singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING;

INSERT INTO tasks (id, company, title, description, budget, payment, skill, level, deadline, applicants, match, rating, verified)
VALUES
  ('t1', 'Tariro Pharmacy', 'Design a professional price list', 'Create a clean pharmacy price list that staff can update easily. Use Excel with clear categories, prices and automatic markup calculations.', 30, 'USD', 'Excel', 'Intermediate', '18h left', 5, 92, 4.8, TRUE),
  ('t2', 'Gateway Church Mabelreign', 'Build a WhatsApp bot for church', 'Build a simple WhatsApp-style bot flow for announcements, service times and frequently asked questions. Keep the conversation easy for members to use.', 15, 'EcoCash', 'Coding', 'Entry level', '1d left', 2, 81, 4.6, TRUE),
  ('t3', 'Rudo M. • UZ', 'Type and format my dissertation', 'Type and professionally format an 80-page University of Zimbabwe dissertation. Apply consistent headings, page numbering, tables and references.', 50, 'USD', 'Writing', 'Professional', '2d left', 1, 76, 4.9, TRUE),
  ('t4', 'Mbare Youth Trust', 'Translate a Shona health flyer', 'Translate a short health-awareness flyer from English into natural, easy-to-understand Shona while preserving the intended meaning and tone.', 20, 'USD', 'Translation', 'Intermediate', '20h left', 2, 88, 4.7, TRUE),
  ('t5', 'Kudzi''s Kitchen', 'Design a modern menu board', 'Create a clean digital menu board for a growing Harare food business. The design should work for WhatsApp sharing and social media.', 25, 'USD', 'Design', 'Entry level', '1d left', 4, 90, 4.8, TRUE),
  ('t6', 'Chinhoyi Agro Supplies', 'Build an Excel stock tracker', 'Create an easy stock sheet with product quantities, reorder warnings and simple totals for a small agricultural supplies shop.', 35, 'EcoCash', 'Excel', 'Advanced', '3d left', 3, 86, 4.5, TRUE),
  ('t7', 'ZimRide Shuttles', 'Fix our React booking page', 'Debug a small React booking interface and fix the form validation and mobile layout. Existing code will be supplied to the selected student.', 40, 'USD', 'Coding', 'Professional', '2d left', 5, 94, 4.9, TRUE),
  ('t8', 'Bulawayo Arts Festival', 'Create a festival poster series', 'Design three coordinated promotional posters for a student-friendly arts event in Bulawayo. Final files should be ready for digital sharing.', 45, 'USD', 'Design', 'Advanced', '4d left', 6, 89, 4.8, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS tasks_owner_user_id_idx ON tasks(owner_user_id);
CREATE INDEX IF NOT EXISTS applications_student_id_idx ON applications(student_id);
CREATE INDEX IF NOT EXISTS applications_task_id_idx ON applications(task_id);
CREATE INDEX IF NOT EXISTS certificates_student_id_idx ON certificates(student_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
