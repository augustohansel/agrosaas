from pathlib import Path
from tempfile import TemporaryDirectory
import os, secrets, shutil, socket, subprocess, time
bin=Path(os.environ.get('PGBIN') or (Path(shutil.which('initdb')).parent if shutil.which('initdb') else r'C:\Program Files\PostgreSQL\18\bin'))
root=Path(__file__).resolve().parents[2]
base="""
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create type user_role as enum ('owner','manager','viewer');
create table profiles(id uuid primary key references auth.users,full_name text,created_at timestamptz default now());
create table farms(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz default now(),latitude numeric,longitude numeric,created_by uuid default auth.uid());
create table farm_members(farm_id uuid references farms,user_id uuid references profiles,role user_role default 'viewer',primary key(farm_id,user_id));
create table plots(id uuid primary key default gen_random_uuid(),farm_id uuid not null references farms,name text not null,coordinates jsonb not null,created_at timestamptz default now());
create table transactions(id uuid primary key default gen_random_uuid(),farm_id uuid not null references farms,amount numeric not null,category text not null,description text,transaction_date date not null,created_by uuid not null references profiles,created_at timestamptz default now(),type text,plot_id uuid references plots);
"""
with TemporaryDirectory(prefix="agro-qa-") as tmp:
    host="127.0.0.1"
    with socket.socket() as sock:
        sock.bind((host,0)); port=sock.getsockname()[1]
    tmp=Path(tmp)
    pw=secrets.token_hex(32)
    pwfile=tmp/'pw'; pwfile.write_text(pw+'\n')
    env=dict(os.environ,PGPASSWORD=pw,PGCLIENTENCODING="UTF8")
    def run(args,sql=None,check=True):
        p=subprocess.run(args,input=sql,env=env,encoding='utf-8',errors='replace',capture_output=True,timeout=60)
        if check and p.returncode: raise RuntimeError(p.stderr+p.stdout[-2000:])
        return p
    db=tmp/'db'
    print('Preparando PostgreSQL temporário...', flush=True)
    run([bin/'initdb','-D',db,'-U','tester','-A','scram-sha-256','--pwfile',pwfile,'--encoding=UTF8','--locale=C'])
    ctl=[bin/'pg_ctl','-D',db]
    subprocess.run(ctl+['-l',tmp/'pg.log','-o',f'-p {port} -h {host}','-w','start'],
                   stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                   env=env,timeout=60,check=True)
    try:
        cli=[bin/'psql','-X','-h',host,'-p',str(port),'-U','tester','-d','postgres','-Atq','-v','ON_ERROR_STOP=1','-f','-']
        def sql(s): return run(cli,s).stdout.strip()
        print('Aplicando migrations locais...', flush=True)
        sql(base)
        for f in sorted((root/'supabase/migrations').glob('*.sql')): sql(f.read_text(encoding='utf-8-sig'))
        contract=(root/'supabase/tests/erp_contract.sql').read_text(encoding='utf-8')
        sql(contract)
        print('Contrato ERP com rollback aprovado.',flush=True)
        # Keep the same fixture only in this disposable cluster for multi-session checks.
        assert contract.rstrip().endswith("rollback;")
        sql(contract.rstrip()[:-len("rollback;")]+"commit;")
        farm,owner,cycle,machine,lot=sql("""select f.id,f.created_by,c.id,m.id,l.id from farms f join crop_cycles c on c.farm_id=f.id join machines m on m.farm_id=f.id join input_lots l on l.farm_id=f.id where l.code='Diesel A'""").split('|')
        session=f"begin; set local role authenticated; select set_config('request.jwt.claim.sub','{owner}',true); "
        def race(statement,expect_error=False):
            first=subprocess.Popen(cli,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,encoding='utf8',env=env)
            first.stdin.write(session+statement+";\n\\echo holding\n"); first.stdin.flush()
            while True:
                line=first.stdout.readline()
                if line.strip()=='holding': break
                if not line: raise RuntimeError(first.stderr.read())
            second=subprocess.Popen(cli,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,encoding='utf8',env=dict(env,PGAPPNAME="erp-competitor"))
            second.stdin.write(session+statement+";commit;\n"); second.stdin.close()
            try:
                for _ in range(80):
                    if sql("select count(*) from pg_stat_activity where application_name='erp-competitor' and wait_event_type='Lock'")=='1': break
                    time.sleep(.025)
                else: raise RuntimeError("Second session did not wait on the first.")
            finally:
                first.stdin.write("commit;\n"); first.stdin.close()
                first.wait(timeout=10); second.wait(timeout=10)
            assert first.returncode==0
            stderr=second.stderr.read()
            if expect_error: assert second.returncode and 'Saldo insuficiente' in stderr,stderr
            else: assert second.returncode==0,stderr
        race(f"select refuel_machine(gen_random_uuid(),'{farm}','{lot}',60,'{machine}',4,'{cycle}')",True)
        assert sql(f"select quantity=20 from input_lots where id='{lot}'")=='t'
        bill=sql(f"insert into bills(farm_id,cycle_id,kind,basis,description,amount,due_on) values('{farm}','{cycle}','receivable','sale','Concorrencia',200,current_date) returning id")
        race(f"select settle_bill('{farm}','{bill}',current_date)")
        assert sql("select count(*) from transactions where description='Concorrencia'")=='1'
        job=sql(f"insert into work_orders(farm_id,cycle_id,machine_id,operator_id,kind,planned_on,area_ha) values('{farm}','{cycle}','{machine}','{owner}','planting',current_date,1) returning id")
        sql(f"insert into order_inputs values('{farm}','{job}','{lot}',1);"+session+f"select advance_order('{farm}','{job}','running');commit;")
        race(f"select advance_order('{farm}','{job}','completed',1)")
        assert sql(f"select count(*) from stock_moves where order_id='{job}'")=='1'
        print('Concorrência aprovada: saldo do lote, liquidação única e conclusão única da OS.')
    finally:
        run(ctl+['-m','fast','-w','stop'])
