ALTER TABLE tickets ADD COLUMN face_id bigint NOT NULL;
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_face FOREIGN KEY (face_id) REFERENCES faces (id);