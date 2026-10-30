use rusqlite::Connection;
use shared::sqlite::{SqlitePool, make_readonly_pool};

/// Creates a temp SQLite file seeded with the full search schema and sample rows.
pub fn create_test_db() -> tempfile::NamedTempFile {
    let file = tempfile::NamedTempFile::new().expect("temp file");
    let conn = Connection::open(file.path()).expect("open");
    conn.execute_batch(
        "
        CREATE TABLE doc_projection (
            doc_id              INTEGER PRIMARY KEY,
            doc_type            TEXT NOT NULL,
            doc_number          TEXT NOT NULL,
            name                TEXT,
            birth_date          TEXT,
            birth_place         TEXT,
            sex                 TEXT,
            marital_status      TEXT,
            location_text       TEXT,
            ubigeo_code         TEXT,
            mother_name         TEXT,
            father_name         TEXT,
            email               TEXT,
            person_ruc          TEXT,
            org_ruc             TEXT,
            org_name            TEXT,
            trade_name          TEXT,
            company_type        TEXT,
            org_status          TEXT,
            org_condition       TEXT,
            fiscal_address      TEXT,
            registration_date   TEXT,
            activity_start_date TEXT,
            line_of_business    TEXT,
            economic_activity   TEXT,
            org_ubigeo_code     TEXT,
            org_department      TEXT,
            org_province        TEXT,
            org_district        TEXT,
            role_name           TEXT,
            role_start_date     TEXT,
            rep_doc_type        TEXT,
            rep_doc_number      TEXT,
            rep_name            TEXT,
            phone_primary       TEXT,
            phone_secondary     TEXT
        );
        CREATE TABLE company_projection (
            company_id          INTEGER PRIMARY KEY,
            ruc                 TEXT NOT NULL,
            legal_name          TEXT,
            trade_name          TEXT,
            company_type        TEXT,
            org_status          TEXT,
            org_condition       TEXT,
            fiscal_address      TEXT,
            registration_date   TEXT,
            activity_start_date TEXT,
            line_of_business    TEXT,
            economic_activity   TEXT,
            org_ubigeo_code     TEXT,
            org_department      TEXT,
            org_province        TEXT,
            org_district        TEXT,
            phone_primary       TEXT,
            phone_secondary     TEXT
        );
        CREATE TABLE company_people_projection (
            company_id          INTEGER NOT NULL,
            position            INTEGER NOT NULL,
            doc_type            TEXT,
            doc_number          TEXT,
            name                TEXT,
            role_name           TEXT,
            role_start_date     TEXT,
            PRIMARY KEY(company_id, position)
        );
        CREATE TABLE doc_projection_phone_index (
            phone   TEXT    NOT NULL,
            doc_id  INTEGER NOT NULL,
            UNIQUE(phone, doc_id)
        );
        CREATE TABLE company_projection_phone_index (
            phone       TEXT    NOT NULL,
            company_id  INTEGER NOT NULL,
            UNIQUE(phone, company_id)
        );
        CREATE VIRTUAL TABLE doc_projection_fts USING fts5(
            doc_name,
            tokenize='unicode61 remove_diacritics 1'
        );
        CREATE VIRTUAL TABLE company_projection_fts USING fts5(
            company_name,
            tokenize='unicode61 remove_diacritics 1'
        );
        CREATE TABLE ruc_phone_agg (org_ruc TEXT PRIMARY KEY, phones TEXT NOT NULL);
        CREATE TABLE doc_phone_agg (doc_id INTEGER PRIMARY KEY, phones TEXT NOT NULL);

        INSERT INTO doc_projection(
            doc_id, doc_type, doc_number, name, birth_date, sex,
            org_ruc, org_name, trade_name, org_status, fiscal_address,
            role_name, role_start_date, phone_primary, phone_secondary
        ) VALUES
            (1,'DNI','12345678','JUAN PEREZ','1980-05-10','M',
             '20100011111','ACME SAC','ACME','ACTIVO','AV. LIMA 123',
             'GERENTE GENERAL','2020-01-01',
             '999111222','999333444'),
            (2,'DNI','87654321','MARIA LOPEZ',NULL,'F',
             '20100011111','ACME SAC','ACME','ACTIVO','AV. LIMA 123',
             'SOCIO','2020-01-01',
             '988777666',NULL),
            (3,'DNI','11223344','CARLOS DIAZ',NULL,NULL,
             NULL,NULL,NULL,NULL,NULL,
             NULL,NULL,
             '977000111',NULL);

        INSERT INTO company_projection(
            company_id, ruc, legal_name, trade_name, org_status, fiscal_address,
            phone_primary, phone_secondary
        ) VALUES
            (1,'20100011111','ACME SAC','ACME','ACTIVO','AV. LIMA 123',
             '999111222','999333444'),
            (2,'20100022222','GLOBEX SAC',NULL,'ACTIVO',NULL,NULL,NULL);

        INSERT INTO company_people_projection(
            company_id, position, doc_type, doc_number, name, role_name, role_start_date
        ) VALUES
            (1,1,'DNI','12345678','JUAN PEREZ','GERENTE GENERAL','2020-01-01'),
            (1,2,'DNI','87654321','MARIA LOPEZ','SOCIO',NULL);

        INSERT INTO doc_projection_phone_index(phone, doc_id) VALUES
            ('999111222',1),('999333444',1),('988777666',2),('977000111',3);

        INSERT INTO company_projection_phone_index(phone, company_id) VALUES
            ('999111222',1),('999333444',1),('988777666',1);

        INSERT INTO ruc_phone_agg(org_ruc, phones) VALUES
            ('20100011111','999111222;999333444;988777666');

        INSERT INTO doc_phone_agg(doc_id, phones) VALUES
            (1,'999111222;999333444'),
            (2,'988777666'),
            (3,'977000111');

        INSERT INTO doc_projection_fts(rowid, doc_name)
        SELECT doc_id, COALESCE(name,'') FROM doc_projection;

        INSERT INTO company_projection_fts(rowid, company_name)
        SELECT company_id, COALESCE(legal_name,'') FROM company_projection;
        ",
    )
    .expect("seed db");
    file
}

/// Opens a read-only pool over a temp file.
pub fn test_pool(file: &tempfile::NamedTempFile) -> SqlitePool {
    make_readonly_pool(file.path().to_str().expect("path")).expect("pool")
}
