CREATE TABLE ${schema~}.todo (
  id int PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE ${schema~}.task (
  id serial PRIMARY KEY,
  todo_id int NOT NULL REFERENCES todo(id),
  name text NOT NULL,
  completed bool DEFAULT FALSE
);
