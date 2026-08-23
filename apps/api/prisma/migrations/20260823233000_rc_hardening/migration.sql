-- A message has one canonical analysis. Repeated or concurrent analyze requests
-- reuse it instead of creating a second set of pending actions.
ALTER TABLE `message_analyses`
  ADD CONSTRAINT `message_analyses_message_id_key` UNIQUE (`message_id`);
