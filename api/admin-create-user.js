module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY"
    });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const { email, password, empresa_id: empresaId, role } = req.body || {};

  if (!email || !password || !empresaId) {
    return res.status(400).json({ error: "email, password and empresa_id are required" });
  }

  const allowedRoles = new Set(["owner", "manager", "user"]);
  const roleValue = allowedRoles.has(role) ? role : "user";

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!userResponse.ok) {
    return res.status(401).json({ error: "Invalid user session" });
  }

  const caller = await userResponse.json();
  const callerUserId = caller?.id;

  if (!callerUserId) {
    return res.status(401).json({ error: "User not identified" });
  }

  const adminCheckResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/platform_admins?select=user_id&user_id=eq.${callerUserId}&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  if (!adminCheckResponse.ok) {
    return res.status(500).json({ error: "Failed to validate platform admin" });
  }

  const adminRows = await adminCheckResponse.json();
  if (!Array.isArray(adminRows) || adminRows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const createUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true
    })
  });

  const createUserPayload = await createUserResponse.json().catch(() => ({}));
  if (!createUserResponse.ok) {
    return res.status(400).json({
      error: createUserPayload.msg || createUserPayload.message || "Failed to create auth user"
    });
  }

  const createdUserId = createUserPayload?.user?.id;
  if (!createdUserId) {
    return res.status(500).json({ error: "Auth user created without ID" });
  }

  const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_empresas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify([
      {
        user_id: createdUserId,
        empresa_id: empresaId,
        role: roleValue,
        ativo: true
      }
    ])
  });

  if (!upsertResponse.ok) {
    const upsertPayload = await upsertResponse.json().catch(() => ({}));
    return res.status(400).json({
      error: upsertPayload.message || "Auth user created but failed to link empresa"
    });
  }

  return res.status(200).json({
    ok: true,
    user_id: createdUserId
  });
};
