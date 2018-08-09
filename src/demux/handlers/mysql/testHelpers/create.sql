CREATE DATABASE demuxmysqltest;
USE demuxmysqltest;

CREATE TABLE todo (
  id int NOT NULL,
  name text NOT NULL,
  PRIMARY KEY(id)
);

CREATE TABLE task (
  id int NOT NULL AUTO_INCREMENT,
  todo_id int NOT NULL REFERENCES todos(id),
  name text NOT NULL,
  completed bool DEFAULT FALSE,
  PRIMARY KEY(id)
);

CREATE TABLE _index_state (
  id int NOT NULL,
  block_number int NOT NULL,
  block_hash text NOT NULL,
  is_replay boolean NOT NULL,
  PRIMARY KEY (id)
);
