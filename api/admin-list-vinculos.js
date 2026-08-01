module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
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

  const vinculosResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/usuarios_empresas?select=user_id,empresa_id,role,ativo,created_at,empresas(id,nome)&order=created_at.desc&limit=1000`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  if (!vinculosResponse.ok) {
    const payload = await vinculosResponse.json().catch(() => ({}));
    return res.status(400).json({
      error: payload.message || "Failed to load vinculos"
    });
  }

  const vinculos = await vinculosResponse.json();
  if (!Array.isArray(vinculos)) {
    return res.status(500).json({ error: "Invalid vinculos payload" });
  }

  const emailByUserId = {};
  let page = 1;
  const perPage = 200;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const usersResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!usersResponse.ok) {
      break;
    }

    const usersPayload = await usersResponse.json().catch(() => ({}));
    const users = Array.isArray(usersPayload?.users)
      ? usersPayload.users
      : Array.isArray(usersPayload)
        ? usersPayload
        : [];

    for (const user of users) {
      if (user?.id) {
        emailByUserId[user.id] = user.email || "";
      }
    }

    hasMore = users.length >= perPage;
    page += 1;
  }

  const enriched = vinculos.map((row) => ({
    user_id: row.user_id,
    empresa_id: row.empresa_id,
    role: row.role || "user",
    ativo: row.ativo !== false,
    created_at: row.created_at || null,
    email: emailByUserId[row.user_id] || "",
    empresas: row.empresas || null
  }));

  return res.status(200).json({
    ok: true,
    vinculos: enriched,
    total: enriched.length
  });
};
