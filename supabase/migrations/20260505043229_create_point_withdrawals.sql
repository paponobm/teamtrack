create table public.point_withdrawals (
    id uuid default gen_random_uuid() primary key,
    employee_id uuid references public.employees(id) on delete cascade not null,
    amount integer not null check (amount >= 500),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
    processed_at timestamp with time zone,
    processed_by uuid references public.employees(id) on delete set null
);

-- Enable RLS
alter table public.point_withdrawals enable row level security;

-- Policies for point_withdrawals
create policy "Employees can view their own withdrawals"
    on public.point_withdrawals for select
    using (auth.uid() in (
        select user_id from public.employees where id = point_withdrawals.employee_id
    ));

create policy "Employees can insert their own withdrawals"
    on public.point_withdrawals for insert
    with check (auth.uid() in (
        select user_id from public.employees where id = point_withdrawals.employee_id
    ));

create policy "Admins can view all withdrawals"
    on public.point_withdrawals for select
    using (
        exists (
            select 1 from public.employees e
            join public.roles r on e.role_id = r.id
            where e.user_id = auth.uid() and r.name in ('Admin', 'Super Admin')
        )
    );

create policy "Admins can update withdrawals"
    on public.point_withdrawals for update
    using (
        exists (
            select 1 from public.employees e
            join public.roles r on e.role_id = r.id
            where e.user_id = auth.uid() and r.name in ('Admin', 'Super Admin')
        )
    );
