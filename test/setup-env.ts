// Several tests sign and verify JWTs with these secrets, and some use tokens signed beforehand with
// exactly these values. CI writes them to .env; a fresh clone or a new worktree has no .env, and the
// auth tests then failed. Values from .env still win: it is loaded first and only blanks are filled.
import "dotenv/config";

process.env.TEST_ACCESS_TOKEN_SECRET ||= "access_secret";
process.env.TEST_REFRESH_TOKEN_SECRET ||= "refresh_secret";
