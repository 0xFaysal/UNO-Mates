-- Explicit row predicates are required by PostgREST's safe-update guard.
CREATE OR REPLACE FUNCTION public.uno_admin_change_password(p_token_hash text,p_current text,p_new text,p_replacement_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a uno_private.admin_account; attempt_key text:='change:'||p_token_hash;
BEGIN
 IF length(p_new)<12 OR octet_length(p_new)>72 OR octet_length(p_current)>72 OR p_replacement_hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false); END IF;
 SELECT * INTO a FROM uno_private.admin_account FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM uno_private.admin_sessions WHERE token_hash=p_token_hash AND expires_at>now()) THEN RETURN jsonb_build_object('ok',false,'expired',true); END IF;
 INSERT INTO uno_private.admin_attempts(key) VALUES(attempt_key) ON CONFLICT DO NOTHING;
 UPDATE uno_private.admin_attempts SET attempts=0,window_start=now() WHERE key=attempt_key AND window_start<now()-interval '15 minutes';
 IF EXISTS(SELECT 1 FROM uno_private.admin_attempts WHERE key=attempt_key AND attempts>=8) THEN RETURN jsonb_build_object('ok',false,'limited',true); END IF;
 UPDATE uno_private.admin_attempts SET attempts=attempts+1 WHERE key=attempt_key;
 IF extensions.crypt(p_current,a.password_hash)<>a.password_hash THEN RETURN jsonb_build_object('ok',false); END IF;
 IF extensions.crypt(p_new,a.password_hash)=a.password_hash THEN RETURN jsonb_build_object('ok',false,'same',true); END IF;
 UPDATE uno_private.admin_account SET password_hash=extensions.crypt(p_new,extensions.gen_salt('bf',12)),changed_at=now() WHERE singleton=true;
 DELETE FROM uno_private.admin_sessions WHERE token_hash<>p_replacement_hash;
 DELETE FROM uno_private.admin_attempts WHERE key=attempt_key;
 INSERT INTO uno_private.admin_sessions(token_hash,expires_at) VALUES(p_replacement_hash,now()+interval '8 hours');
 RETURN jsonb_build_object('ok',true);
END;
$$;

