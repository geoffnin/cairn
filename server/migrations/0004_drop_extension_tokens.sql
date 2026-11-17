-- Sign-in is now handled entirely by Cloudflare Access (decision D20); the extension no longer
-- holds its own tokens.
DROP TABLE IF EXISTS extension_tokens;
