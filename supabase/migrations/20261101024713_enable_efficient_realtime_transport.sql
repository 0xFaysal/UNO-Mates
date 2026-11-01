-- Apply only AFTER the protocol-2 frontend is serving production traffic.
-- Protect every existing seat, including tabs opened during the staged rollout.
UPDATE public.players SET realtime_legacy=true WHERE NOT realtime_legacy;
UPDATE uno_private.realtime_transport SET enabled=true WHERE singleton=true;
-- Emergency rollback: set enabled=false before rolling back the frontend.
