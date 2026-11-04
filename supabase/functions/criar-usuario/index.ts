import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function getDefaultApiKey(variableName: string): string | undefined {
    const rawKeys = Deno.env.get(variableName);
    if (!rawKeys) {
        return undefined;
    }

    const keys: unknown = JSON.parse(rawKeys);
    if (
        typeof keys !== "object" ||
        keys === null ||
        !("default" in keys) ||
        typeof keys.default !== "string"
    ) {
        return undefined;
    }

    return keys.default;
}

Deno.serve(async request => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return Response.json(
            { error: "Método não permitido." },
            { status: 405, headers: corsHeaders }
        );
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return Response.json(
            { error: "Sessão inválida." },
            { status: 401, headers: corsHeaders }
        );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
        getDefaultApiKey("SUPABASE_PUBLISHABLE_KEYS");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
        getDefaultApiKey("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        console.error("Variáveis obrigatórias da função não configuradas.");
        return Response.json(
            { error: "A função de cadastro não está configurada." },
            { status: 500, headers: corsHeaders }
        );
    }

    const token = authorization.slice("Bearer ".length);
    const clienteUsuario = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false }
    });
    const { data: usuarioData, error: erroUsuario } =
        await clienteUsuario.auth.getUser(token);

    if (erroUsuario || !usuarioData.user) {
        return Response.json(
            { error: "Sessão inválida ou expirada." },
            { status: 401, headers: corsHeaders }
        );
    }

    const clienteAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: perfil, error: erroPerfil } = await clienteAdmin
        .from("profiles")
        .select("role")
        .eq("id", usuarioData.user.id)
        .maybeSingle();

    if (erroPerfil) {
        console.error("Falha ao consultar o perfil administrativo:", erroPerfil);
        return Response.json(
            { error: "Não foi possível validar as permissões." },
            { status: 500, headers: corsHeaders }
        );
    }
    if (perfil?.role !== "admin") {
        return Response.json(
            { error: "Somente administradores podem cadastrar usuários." },
            { status: 403, headers: corsHeaders }
        );
    }

    let entrada: { email?: string; nome?: string; matricula?: string };
    try {
        entrada = await request.json();
    } catch {
        return Response.json(
            { error: "Corpo da solicitação inválido." },
            { status: 400, headers: corsHeaders }
        );
    }

    const email = entrada.email?.trim().toLowerCase();
    const nome = entrada.nome?.trim();
    const matricula = entrada.matricula?.trim().toUpperCase();
    if (!email || !nome || nome.length < 2 || !matricula) {
        return Response.json(
            { error: "Informe e-mail, nome e matrícula válidos." },
            { status: 400, headers: corsHeaders }
        );
    }

    const { data: convite, error: erroConvite } =
        await clienteAdmin.auth.admin.inviteUserByEmail(email, {
            data: { nome, matricula }
        });

    if (erroConvite) {
        console.error("Falha ao enviar convite:", erroConvite);
        return Response.json(
            { error: "Não foi possível convidar esse usuário." },
            { status: 400, headers: corsHeaders }
        );
    }

    return Response.json(
        { id: convite.user.id, email: convite.user.email },
        { status: 201, headers: corsHeaders }
    );
});
