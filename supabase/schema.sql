create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    nome text not null,
    matricula text unique,
    role text not null default 'pendente'
        check (role in ('admin', 'operador', 'pendente')),
    criado_em timestamptz not null default now()
);

create table if not exists public.pneus (
    id text primary key,
    numero_fogo text not null default '',
    dot text not null default '',
    marca text not null default '',
    modelo text not null default '',
    medida text not null default '',
    estado text not null check (estado in ('NOVO', 'RECAPADO', 'MEIA_VIDA')),
    data_entrada date,
    status text not null check (status in (
        'APLICADO',
        'CONSERTO_OFICINA',
        'DESCARTE',
        'PARA_RECAPE',
        'EM_RECAPE',
        'RESERVA_PRONTA_UTILIZACAO',
        'ESTOQUE',
        'INSTALADO',
        'MANUTENCAO'
    )),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    historico_identificacoes jsonb not null default '[]'::jsonb
);

create table if not exists public.equipamentos (
    id text primary key,
    tipo text not null default '',
    layout text not null default '',
    tag text not null unique,
    placa text not null default '',
    marca text not null default '',
    modelo text not null default '',
    setor text not null default '',
    responsavel text not null default '',
    observacoes text not null default '',
    status text not null default 'ATIVO',
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create table if not exists public.posicoes (
    id text primary key,
    id_equipamento text not null
        references public.equipamentos (id) on delete cascade,
    codigo text not null,
    eixo integer not null default 0,
    lado text not null default '',
    posicao text not null default '',
    status text not null default 'ATIVA',
    id_pneu_instalado text
        references public.pneus (id) on delete restrict,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz,
    unique (id_equipamento, codigo)
);

create unique index if not exists posicoes_pneu_instalado_unico
    on public.posicoes (id_pneu_instalado)
    where id_pneu_instalado is not null;

create table if not exists public.movimentacoes (
    id text primary key,
    tipo text not null check (tipo in ('INSTALACAO', 'RETIRADA')),
    id_pneu text not null references public.pneus (id) on delete restrict,
    id_equipamento text not null
        references public.equipamentos (id) on delete restrict,
    id_posicao text not null references public.posicoes (id) on delete restrict,
    codigo_posicao text not null,
    data_movimentacao date not null,
    motivo text,
    status_pneu_apos_retirada text,
    criado_em timestamptz not null default now()
);

create table if not exists public.recapagens (
    id text primary key,
    id_pneu text not null references public.pneus (id) on delete restrict,
    empresa text not null default '',
    data_envio date not null,
    data_retorno date,
    custo numeric(12, 2) not null default 0,
    km_envio numeric(14, 2),
    km_retorno numeric(14, 2),
    horimetro_envio numeric(14, 2),
    horimetro_retorno numeric(14, 2),
    status text not null default '',
    observacoes text not null default '',
    criado_em timestamptz not null default now()
);

alter table public.pneus
    add column if not exists arquivado_em timestamptz;
alter table public.equipamentos
    add column if not exists arquivado_em timestamptz;
alter table public.posicoes
    add column if not exists arquivado_em timestamptz;
alter table public.movimentacoes
    add column if not exists arquivado_em timestamptz;
alter table public.recapagens
    add column if not exists arquivado_em timestamptz;

create index if not exists pneus_status_idx on public.pneus (status);
create index if not exists movimentacoes_pneu_data_idx
    on public.movimentacoes (id_pneu, data_movimentacao desc);
create index if not exists recapagens_pneu_data_idx
    on public.recapagens (id_pneu, data_envio desc);

create or replace function public.criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, nome, matricula, role)
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
        nullif(upper(trim(new.raw_user_meta_data ->> 'matricula')), ''),
        case when new.invited_at is not null then 'operador' else 'pendente' end
    )
    on conflict (id) do update
        set email = excluded.email;
    return new;
end;
$$;

drop trigger if exists maintix_criar_perfil on auth.users;
create trigger maintix_criar_perfil
    after insert on auth.users
    for each row execute function public.criar_perfil_usuario();

create or replace function public.eh_membro_maintix()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and role in ('admin', 'operador')
    );
$$;

create or replace function public.eh_admin_maintix()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and role = 'admin'
    );
$$;

revoke all on function public.eh_membro_maintix() from public, anon;
revoke all on function public.eh_admin_maintix() from public, anon;
grant execute on function public.eh_membro_maintix() to authenticated;
grant execute on function public.eh_admin_maintix() to authenticated;

create or replace function public.validar_arquivamento_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if new.arquivado_em is not null and not public.eh_admin_maintix() then
            raise exception 'Somente administradores podem arquivar registros.';
        end if;
    elsif new.arquivado_em is distinct from old.arquivado_em
        and not public.eh_admin_maintix() then
        raise exception 'Somente administradores podem arquivar ou restaurar registros.';
    end if;
    return new;
end;
$$;

revoke all on function public.validar_arquivamento_admin() from public, anon, authenticated;

do $$
declare
    tabela text;
begin
    foreach tabela in array array[
        'pneus',
        'equipamentos',
        'posicoes',
        'movimentacoes',
        'recapagens'
    ]
    loop
        execute format(
            'drop trigger if exists validar_arquivamento_admin on public.%I',
            tabela
        );
        execute format(
            'create trigger validar_arquivamento_admin before insert or update of arquivado_em on public.%I for each row execute function public.validar_arquivamento_admin()',
            tabela
        );
    end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.pneus enable row level security;
alter table public.equipamentos enable row level security;
alter table public.posicoes enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.recapagens enable row level security;

drop policy if exists "Perfis visiveis ao proprio usuario e administradores"
    on public.profiles;
create policy "Perfis visiveis ao proprio usuario e administradores"
    on public.profiles for select to authenticated
    using (id = (select auth.uid()) or (select public.eh_admin_maintix()));

drop policy if exists "Somente administradores alteram perfis" on public.profiles;
create policy "Somente administradores alteram perfis"
    on public.profiles for update to authenticated
    using ((select public.eh_admin_maintix()))
    with check ((select public.eh_admin_maintix()));

do $$
declare
    tabela text;
begin
    foreach tabela in array array[
        'pneus',
        'equipamentos',
        'posicoes',
        'movimentacoes',
        'recapagens'
    ]
    loop
        execute format('drop policy if exists "Acesso de membros" on public.%I', tabela);
        execute format(
            'create policy "Acesso de membros" on public.%I for all to authenticated using ((select public.eh_membro_maintix())) with check ((select public.eh_membro_maintix()))',
            tabela
        );
    end loop;
end;
$$;

create or replace function public.criar_equipamento_com_posicoes(
    p_equipamento jsonb,
    p_posicoes jsonb
)
returns text
language plpgsql
set search_path = public
as $$
declare
    equipamento_id text;
begin
    if not public.eh_membro_maintix() then
        raise exception 'Usuário sem acesso ao MAINTIX.';
    end if;

    insert into public.equipamentos
    select * from jsonb_populate_record(null::public.equipamentos, p_equipamento)
    returning id into equipamento_id;

    insert into public.posicoes
    select *
    from jsonb_populate_recordset(null::public.posicoes, p_posicoes);

    return equipamento_id;
end;
$$;

create or replace function public.instalar_pneu(
    p_id_pneu text,
    p_id_equipamento text,
    p_id_posicao text,
    p_id_movimentacao text,
    p_data date
)
returns void
language plpgsql
set search_path = public
as $$
declare
    pneu public.pneus%rowtype;
    equipamento public.equipamentos%rowtype;
    posicao public.posicoes%rowtype;
    agora timestamptz := now();
begin
    if not public.eh_membro_maintix() then
        raise exception 'Usuário sem acesso ao MAINTIX.';
    end if;

    select * into equipamento
    from public.equipamentos
    where id = p_id_equipamento
    for update;
    if not found or equipamento.arquivado_em is not null then
        raise exception 'O equipamento não existe ou está arquivado.';
    end if;

    select * into pneu from public.pneus where id = p_id_pneu for update;
    if not found or pneu.arquivado_em is not null then
        raise exception 'Pneu não encontrado ou arquivado.';
    end if;
    if pneu.status not in ('RESERVA_PRONTA_UTILIZACAO', 'ESTOQUE') then
        raise exception 'O pneu não está disponível para instalação.';
    end if;

    select * into posicao from public.posicoes where id = p_id_posicao for update;
    if not found or posicao.id_equipamento <> p_id_equipamento then
        raise exception 'A posição não pertence ao equipamento selecionado.';
    end if;
    if posicao.arquivado_em is not null then
        raise exception 'A posição está arquivada.';
    end if;
    if posicao.id_pneu_instalado is not null then
        raise exception 'Esta posição já está ocupada.';
    end if;
    if exists (
        select 1 from public.posicoes where id_pneu_instalado = p_id_pneu
    ) then
        raise exception 'Este pneu já está instalado em outra posição.';
    end if;

    update public.pneus
    set status = 'APLICADO',
        atualizado_em = agora,
        historico_identificacoes = historico_identificacoes || jsonb_build_array(
            jsonb_build_object(
                'tipo', 'STATUS_PNEU',
                'valorAnterior', pneu.status,
                'valor', 'APLICADO',
                'acao', 'ALTERADO',
                'dataRegistro', agora
            )
        )
    where id = p_id_pneu;

    update public.posicoes
    set id_pneu_instalado = p_id_pneu, atualizado_em = agora
    where id = p_id_posicao;

    insert into public.movimentacoes (
        id, tipo, id_pneu, id_equipamento, id_posicao, codigo_posicao,
        data_movimentacao, criado_em
    ) values (
        p_id_movimentacao, 'INSTALACAO', p_id_pneu, p_id_equipamento,
        p_id_posicao, posicao.codigo, p_data, agora
    );
end;
$$;

create or replace function public.retirar_pneu(
    p_id_equipamento text,
    p_id_posicao text,
    p_id_movimentacao text,
    p_data date,
    p_motivo text,
    p_status_apos_retirada text
)
returns void
language plpgsql
set search_path = public
as $$
declare
    posicao public.posicoes%rowtype;
    pneu public.pneus%rowtype;
    equipamento public.equipamentos%rowtype;
    agora timestamptz := now();
begin
    if not public.eh_membro_maintix() then
        raise exception 'Usuário sem acesso ao MAINTIX.';
    end if;
    if p_status_apos_retirada not in (
        'CONSERTO_OFICINA', 'DESCARTE', 'PARA_RECAPE', 'EM_RECAPE',
        'RESERVA_PRONTA_UTILIZACAO'
    ) then
        raise exception 'Status inválido para retirada.';
    end if;

    select * into equipamento
    from public.equipamentos
    where id = p_id_equipamento
    for update;
    if not found or equipamento.arquivado_em is not null then
        raise exception 'O equipamento não existe ou está arquivado.';
    end if;

    select * into posicao from public.posicoes
    where id = p_id_posicao and id_equipamento = p_id_equipamento
    for update;
    if not found or posicao.id_pneu_instalado is null then
        raise exception 'A posição não está ocupada ou não pertence ao equipamento.';
    end if;
    if posicao.arquivado_em is not null then
        raise exception 'A posição está arquivada.';
    end if;

    select * into pneu from public.pneus where id = posicao.id_pneu_instalado for update;
    if not found or pneu.status <> 'APLICADO' then
        raise exception 'O pneu não foi encontrado ou não está aplicado.';
    end if;

    update public.pneus
    set status = p_status_apos_retirada,
        atualizado_em = agora,
        historico_identificacoes = historico_identificacoes || jsonb_build_array(
            jsonb_build_object(
                'tipo', 'STATUS_PNEU',
                'valorAnterior', pneu.status,
                'valor', p_status_apos_retirada,
                'acao', 'ALTERADO',
                'dataRegistro', agora
            )
        )
    where id = pneu.id;

    update public.posicoes set id_pneu_instalado = null, atualizado_em = agora
    where id = p_id_posicao;

    insert into public.movimentacoes (
        id, tipo, id_pneu, id_equipamento, id_posicao, codigo_posicao,
        data_movimentacao, motivo, status_pneu_apos_retirada, criado_em
    ) values (
        p_id_movimentacao, 'RETIRADA', pneu.id, p_id_equipamento,
        p_id_posicao, posicao.codigo, p_data, p_motivo,
        p_status_apos_retirada, agora
    );
end;
$$;

revoke all on function public.criar_equipamento_com_posicoes(jsonb, jsonb)
    from public, anon;
revoke all on function public.instalar_pneu(text, text, text, text, date)
    from public, anon;
revoke all on function public.retirar_pneu(text, text, text, date, text, text)
    from public, anon;

grant execute on function public.criar_equipamento_com_posicoes(jsonb, jsonb)
    to authenticated;
grant execute on function public.instalar_pneu(text, text, text, text, date)
    to authenticated;
grant execute on function public.retirar_pneu(text, text, text, date, text, text)
    to authenticated;

create or replace function public.alterar_arquivamento(
    p_tabela text,
    p_id text,
    p_arquivar boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    momento timestamptz;
    linhas_afetadas integer;
begin
    if not public.eh_admin_maintix() then
        raise exception 'Somente administradores podem arquivar ou restaurar registros.';
    end if;
    if p_tabela is null or p_id is null or p_tabela not in (
        'pneus', 'equipamentos', 'posicoes', 'movimentacoes', 'recapagens'
    ) or p_arquivar is null then
        raise exception 'Tipo de registro inválido.';
    end if;

    if p_arquivar and p_tabela = 'equipamentos' then
        perform 1 from public.equipamentos where id = p_id for update;
        if not found then raise exception 'Registro não encontrado.'; end if;
    elsif p_arquivar and p_tabela = 'pneus' then
        perform 1 from public.pneus where id = p_id for update;
        if not found then raise exception 'Registro não encontrado.'; end if;
    elsif p_arquivar and p_tabela = 'posicoes' then
        perform 1 from public.posicoes where id = p_id for update;
        if not found then raise exception 'Registro não encontrado.'; end if;
    end if;

    if p_arquivar and p_tabela = 'pneus' and (
        exists (
            select 1 from public.pneus
            where id = p_id and status = 'APLICADO'
        ) or exists (
            select 1 from public.posicoes
            where id_pneu_instalado = p_id and arquivado_em is null
        )
    ) then
        raise exception 'Retire o pneu do equipamento antes de arquivá-lo.';
    end if;

    if p_arquivar and p_tabela = 'equipamentos' and exists (
        select 1 from public.posicoes
        where id_equipamento = p_id
          and id_pneu_instalado is not null
          and arquivado_em is null
    ) then
        raise exception 'Retire os pneus do equipamento antes de arquivá-lo.';
    end if;

    if p_arquivar and p_tabela = 'posicoes' and exists (
        select 1 from public.posicoes
        where id = p_id and id_pneu_instalado is not null
    ) then
        raise exception 'Retire o pneu da posição antes de arquivá-la.';
    end if;

    execute format(
        'update public.%I set arquivado_em = $1 where id = $2 returning arquivado_em',
        p_tabela
    ) into momento using case when p_arquivar then now() else null end, p_id;
    get diagnostics linhas_afetadas = row_count;
    if linhas_afetadas = 0 then
        raise exception 'Registro não encontrado.';
    end if;
    return momento;
end;
$$;

revoke all on function public.alterar_arquivamento(text, text, boolean)
    from public, anon;
grant execute on function public.alterar_arquivamento(text, text, boolean)
    to authenticated;
