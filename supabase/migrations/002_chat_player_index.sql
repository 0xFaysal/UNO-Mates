-- Covers the player foreign key for roster-removal cascades and chat joins.
create index if not exists idx_chat_messages_player_id on public.chat_messages (player_id);
