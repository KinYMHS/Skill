CREATE TABLE skill_updates (
  name TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL,
  usage TEXT NOT NULL,
  example TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0)
);
