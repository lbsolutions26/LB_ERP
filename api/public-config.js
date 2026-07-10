module.exports = function handler(req, res) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY"
    });
  }

  return res.status(200).json({
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  });
};
