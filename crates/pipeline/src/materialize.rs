use crate::PipelineError;
use crate::storage::db::open_rw;

/// Bounds RAM used by ranking sorts and WAL growth per transaction.
const CHUNK_ROWS: usize = 250_000;

/// Rebuilds serving rows whose staging data changed.
///
/// Each chunk commits independently. Dirty ids are removed only after their
/// projection is committed, so an interrupted run resumes from what remains.
pub fn materialize_serving(db_path: &str) -> Result<(), PipelineError> {
    let mut conn = open_rw(db_path)?;

    let docs = drain_dirty_docs(&mut conn, CHUNK_ROWS)?;
    let companies = drain_dirty_companies(&mut conn, CHUNK_ROWS)?;

    if docs == 0 && companies == 0 {
        println!("materialized serving tables (no changes)");
        return Ok(());
    }

    println!("materialized serving tables docs={docs} companies={companies}");

    Ok(())
}

fn drain_dirty_docs(
    conn: &mut rusqlite::Connection,
    chunk_rows: usize,
) -> Result<i64, PipelineError> {
    conn.execute_batch(
        "CREATE TEMP TABLE IF NOT EXISTS tmp_dirty_doc_ids(doc_id INTEGER PRIMARY KEY)",
    )?;

    let mut total = 0i64;

    loop {
        let tx = conn.transaction()?;

        let claimed = tx.execute(
            "INSERT INTO tmp_dirty_doc_ids(doc_id)
             SELECT doc_id FROM projection_dirty_doc LIMIT ?1",
            [chunk_rows as i64],
        )?;

        if claimed == 0 {
            tx.commit()?;
            return Ok(total);
        }

        materialize_doc_projection(&tx)?;

        tx.execute_batch(
            "DELETE FROM projection_dirty_doc
             WHERE doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids);
             DELETE FROM tmp_dirty_doc_ids;",
        )?;

        tx.commit()?;
        total += claimed as i64;
    }
}

fn drain_dirty_companies(
    conn: &mut rusqlite::Connection,
    chunk_rows: usize,
) -> Result<i64, PipelineError> {
    conn.execute_batch(
        "CREATE TEMP TABLE IF NOT EXISTS tmp_dirty_company_ids(company_id INTEGER PRIMARY KEY)",
    )?;

    let mut total = 0i64;

    loop {
        let tx = conn.transaction()?;

        let claimed = tx.execute(
            "INSERT INTO tmp_dirty_company_ids(company_id)
             SELECT company_id FROM projection_dirty_company LIMIT ?1",
            [chunk_rows as i64],
        )?;

        if claimed == 0 {
            tx.commit()?;
            return Ok(total);
        }

        materialize_company_projection(&tx)?;

        tx.execute_batch(
            "DELETE FROM projection_dirty_company
             WHERE company_id IN (SELECT company_id FROM tmp_dirty_company_ids);
             DELETE FROM tmp_dirty_company_ids;",
        )?;

        tx.commit()?;
        total += claimed as i64;
    }
}

fn materialize_doc_projection(tx: &rusqlite::Transaction<'_>) -> Result<(), PipelineError> {
    tx.execute_batch(
        r#"
        DELETE FROM doc_projection_phone_index
        WHERE doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids);

        DELETE FROM doc_projection_fts
        WHERE rowid IN (SELECT doc_id FROM tmp_dirty_doc_ids);

        DELETE FROM doc_projection
        WHERE doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids);

        WITH
        -- Restrict ranking to the dirty chunk. SQLite cannot push the outer
        -- filter through the window function.
        ranked_phone AS (
            SELECT
                dp.doc_id,
                dp.phone,
                ROW_NUMBER() OVER (
                    PARTITION BY dp.doc_id
                    ORDER BY dp.confidence DESC, dp.phone
                ) AS rank_position
            FROM document_phone dp
            WHERE dp.doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids)
        ),
        top_two_phones AS (
            SELECT
                doc_id,
                MAX(CASE WHEN rank_position = 1 THEN phone END) AS phone_primary,
                MAX(CASE WHEN rank_position = 2 THEN phone END) AS phone_secondary
            FROM ranked_phone
            WHERE rank_position <= 2
            GROUP BY doc_id
        ),
        top_best_email AS (
            SELECT doc_id, email
            FROM (
                SELECT
                    de.doc_id,
                    de.email,
                    ROW_NUMBER() OVER (
                        PARTITION BY de.doc_id
                        ORDER BY de.reliability DESC, de.email
                    ) AS rn
                FROM document_email de
                WHERE de.doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids)
            )
            WHERE rn = 1
        )
        INSERT INTO doc_projection(
            doc_id, doc_type, doc_number, name,
            birth_date, birth_place, sex, marital_status, location_text,
            ubigeo_code, mother_name, father_name, email, person_ruc,
            org_ruc, org_name, trade_name, company_type, org_status, org_condition,
            fiscal_address, registration_date, activity_start_date, line_of_business,
            economic_activity, org_ubigeo_code, org_department, org_province, org_district,
            role_name, role_start_date, rep_doc_type, rep_doc_number, rep_name,
            phone_primary, phone_secondary
        )
        SELECT
            d.doc_id,
            d.doc_type,
            d.doc_number,
            NULLIF(da.full_name, '')        AS name,
            da.birth_date,
            da.birth_place,
            da.sex,
            da.marital_status,
            da.location_text,
            da.ubigeo_code,
            da.mother_name,
            da.father_name,
            tbe.email,
            da.natural_ruc10                AS person_ruc,
            NULLIF(cp.ruc, '')              AS org_ruc,
            NULLIF(cp.legal_name, '')       AS org_name,
            cp.trade_name,
            cp.company_type,
            cp.status                       AS org_status,
            cp.condition                    AS org_condition,
            cp.fiscal_address,
            cp.registration_date,
            cp.activity_start_date,
            cp.line_of_business,
            cp.economic_activity,
            cp.ubigeo_code                  AS org_ubigeo_code,
            cp.department                   AS org_department,
            cp.province                     AS org_province,
            cp.district                     AS org_district,
            NULLIF(prd.role_name, '')       AS role_name,
            NULLIF(prd.role_start_date, '') AS role_start_date,
            NULLIF(prd.rep_doc_type, '')    AS rep_doc_type,
            NULLIF(prd.rep_doc_number, '')  AS rep_doc_number,
            NULLIF(prd.rep_name, '')        AS rep_name,
            phones.phone_primary,
            phones.phone_secondary
        FROM document d
        LEFT JOIN document_attribute da ON da.doc_id = d.doc_id
        LEFT JOIN primary_role_by_doc prd ON prd.doc_id = d.doc_id
        LEFT JOIN company cp ON cp.company_id = prd.company_id
        LEFT JOIN top_two_phones phones ON phones.doc_id = d.doc_id
        LEFT JOIN top_best_email tbe ON tbe.doc_id = d.doc_id
        WHERE d.doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids);

        INSERT OR IGNORE INTO doc_projection_phone_index(phone, doc_id)
        SELECT DISTINCT dp.phone, dp.doc_id
        FROM document_phone dp
        WHERE dp.doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids);

        INSERT INTO doc_projection_fts(rowid, doc_name)
        SELECT doc_id, COALESCE(name, '')
        FROM doc_projection
        WHERE doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids);

        DELETE FROM doc_phone_agg
        WHERE doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids);

        INSERT INTO doc_phone_agg(doc_id, phones)
        SELECT doc_id, group_concat(phone, ';')
        FROM (
            SELECT dpi.doc_id, dpi.phone
            FROM doc_projection_phone_index dpi
            WHERE dpi.doc_id IN (SELECT doc_id FROM tmp_dirty_doc_ids)
            GROUP BY dpi.doc_id, dpi.phone
            ORDER BY dpi.doc_id, dpi.phone
        )
        GROUP BY doc_id;
        "#,
    )?;

    Ok(())
}

fn materialize_company_projection(tx: &rusqlite::Transaction<'_>) -> Result<(), PipelineError> {
    tx.execute_batch(
        r#"
        DELETE FROM company_projection_phone_index
        WHERE company_id IN (SELECT company_id FROM tmp_dirty_company_ids);

        DELETE FROM company_projection_fts
        WHERE rowid IN (SELECT company_id FROM tmp_dirty_company_ids);

        DELETE FROM company_projection
        WHERE company_id IN (SELECT company_id FROM tmp_dirty_company_ids);

        DELETE FROM company_people_projection
        WHERE company_id IN (SELECT company_id FROM tmp_dirty_company_ids);

        -- A search result lists a few people; the rest stay in company_role.
        INSERT INTO company_people_projection(
            company_id, position, doc_type, doc_number, name, role_name, role_start_date
        )
        SELECT
            rr.company_id,
            rr.rn,
            NULLIF(rr.rep_doc_type, ''),
            NULLIF(rr.rep_doc_number, ''),
            NULLIF(rr.rep_name, ''),
            NULLIF(rr.role_name, ''),
            NULLIF(rr.role_start_date, '')
        FROM ranked_role_by_company rr
        WHERE rr.company_id IN (SELECT company_id FROM tmp_dirty_company_ids)
          AND rr.rn <= 10;

        WITH
        -- Restrict ranking to the dirty chunk. SQLite cannot push the outer
        -- filter through the window function.
        ranked_phone AS (
            SELECT
                cph.company_id,
                cph.phone,
                ROW_NUMBER() OVER (
                    PARTITION BY cph.company_id
                    ORDER BY cph.confidence DESC, cph.phone
                ) AS rank_position
            FROM company_phone cph
            WHERE cph.company_id IN (SELECT company_id FROM tmp_dirty_company_ids)
        ),
        top_two_phones AS (
            SELECT
                company_id,
                MAX(CASE WHEN rank_position = 1 THEN phone END) AS phone_primary,
                MAX(CASE WHEN rank_position = 2 THEN phone END) AS phone_secondary
            FROM ranked_phone
            WHERE rank_position <= 2
            GROUP BY company_id
        )
        INSERT INTO company_projection(
            company_id, ruc, legal_name, trade_name, company_type,
            org_status, org_condition, fiscal_address, registration_date,
            activity_start_date, line_of_business, economic_activity,
            org_ubigeo_code, org_department, org_province, org_district,
            phone_primary, phone_secondary
        )
        SELECT
            cp.company_id,
            cp.ruc,
            NULLIF(cp.legal_name, '')       AS legal_name,
            cp.trade_name,
            cp.company_type,
            cp.status                       AS org_status,
            cp.condition                    AS org_condition,
            cp.fiscal_address,
            cp.registration_date,
            cp.activity_start_date,
            cp.line_of_business,
            cp.economic_activity,
            cp.ubigeo_code                  AS org_ubigeo_code,
            cp.department                   AS org_department,
            cp.province                     AS org_province,
            cp.district                     AS org_district,
            phones.phone_primary,
            phones.phone_secondary
        FROM company cp
        LEFT JOIN top_two_phones phones ON phones.company_id = cp.company_id
        WHERE cp.company_id IN (SELECT company_id FROM tmp_dirty_company_ids);

        INSERT OR IGNORE INTO company_projection_phone_index(phone, company_id)
        SELECT DISTINCT cph.phone, cph.company_id
        FROM company_phone cph
        WHERE cph.company_id IN (SELECT company_id FROM tmp_dirty_company_ids);

        INSERT INTO company_projection_fts(rowid, company_name)
        SELECT company_id, COALESCE(legal_name, '')
        FROM company_projection
        WHERE company_id IN (SELECT company_id FROM tmp_dirty_company_ids);

        DELETE FROM ruc_phone_agg
        WHERE org_ruc IN (
            SELECT cp2.ruc
            FROM company cp2
            WHERE cp2.company_id IN (SELECT company_id FROM tmp_dirty_company_ids)
        );

        INSERT INTO ruc_phone_agg(org_ruc, phones)
        SELECT org_ruc, group_concat(phone, ';')
        FROM (
            SELECT cp2.ruc AS org_ruc, cpi.phone
            FROM company_projection_phone_index cpi
            JOIN company cp2 ON cp2.company_id = cpi.company_id
            WHERE cpi.company_id IN (SELECT company_id FROM tmp_dirty_company_ids)
            GROUP BY cp2.ruc, cpi.phone
            ORDER BY cp2.ruc, cpi.phone
        )
        GROUP BY org_ruc;
        "#,
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::schema::init_schema;
    use rusqlite::params;

    /// Uses a small chunk size to exercise multiple commits without seeding
    /// hundreds of thousands of rows.
    #[test]
    fn drains_every_dirty_document_across_several_chunks() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir
            .path()
            .join("stage.sqlite")
            .to_string_lossy()
            .to_string();

        init_schema(&path).expect("init schema");

        let mut conn = open_rw(&path).expect("open db");

        {
            let tx = conn.transaction().expect("begin");

            for doc_id in 1..=7i64 {
                tx.execute(
                    "INSERT INTO document(doc_id, doc_type, doc_number) VALUES (?1, 'DNI', ?2)",
                    params![doc_id, format!("{doc_id:08}")],
                )
                .expect("insert document");

                tx.execute(
                    "INSERT INTO projection_dirty_doc(doc_id) VALUES (?1)",
                    params![doc_id],
                )
                .expect("mark dirty");
            }

            tx.commit().expect("commit");
        }

        let drained = drain_dirty_docs(&mut conn, 3).expect("drain");

        assert_eq!(drained, 7);

        let projected: i64 = conn
            .query_row("SELECT COUNT(*) FROM doc_projection", [], |row| row.get(0))
            .expect("projected count");

        let still_dirty: i64 = conn
            .query_row("SELECT COUNT(*) FROM projection_dirty_doc", [], |row| {
                row.get(0)
            })
            .expect("dirty count");

        assert_eq!(projected, 7);
        assert_eq!(still_dirty, 0);
    }

    /// Dated roles rank first (newest first), then undated ones; unnamed
    /// roles are skipped and only the top 10 are kept.
    #[test]
    fn company_people_keep_the_ten_best_ranked_named_roles() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir
            .path()
            .join("stage.sqlite")
            .to_string_lossy()
            .to_string();

        init_schema(&path).expect("init schema");

        let mut conn = open_rw(&path).expect("open db");

        conn.execute(
            "INSERT INTO company(company_id, ruc) VALUES (1, '20100000001')",
            [],
        )
        .expect("insert company");
        conn.execute(
            "INSERT INTO projection_dirty_company(company_id) VALUES (1)",
            [],
        )
        .expect("mark dirty");

        let insert_role = |doc_number: &str, name: &str, start_date: &str| {
            conn.execute(
                "INSERT INTO company_role(company_id, rep_doc_type, rep_doc_number, rep_name, role_name, role_start_date)
                 VALUES (1, 'DNI', ?1, ?2, 'SOCIO', ?3)",
                params![doc_number, name, start_date],
            )
            .expect("insert role");
        };

        insert_role("00000001", "UNDATED", "");
        for day in 1..=11 {
            insert_role(
                &format!("1000000{day:02}"),
                &format!("DATED {day:02}"),
                &format!("2020-01-{day:02}"),
            );
        }
        conn.execute(
            "INSERT INTO company_role(company_id, rep_doc_type, rep_doc_number, rep_name, role_name, role_start_date)
             VALUES (1, '', '', '', 'SOCIO', '2024-01-01')",
            [],
        )
        .expect("insert unnamed role");

        assert_eq!(drain_dirty_companies(&mut conn, 3).expect("drain"), 1);

        let names: Vec<String> = conn
            .prepare(
                "SELECT name FROM company_people_projection WHERE company_id = 1 ORDER BY position",
            )
            .expect("prepare")
            .query_map([], |row| row.get(0))
            .expect("query")
            .collect::<Result<_, _>>()
            .expect("collect");

        let expected: Vec<String> = (2..=11)
            .rev()
            .map(|day| format!("DATED {day:02}"))
            .collect();

        assert_eq!(names, expected);
    }

    #[test]
    fn draining_a_clean_database_claims_nothing() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir
            .path()
            .join("stage.sqlite")
            .to_string_lossy()
            .to_string();

        init_schema(&path).expect("init schema");

        let mut conn = open_rw(&path).expect("open db");

        assert_eq!(drain_dirty_docs(&mut conn, 3).expect("drain docs"), 0);
        assert_eq!(
            drain_dirty_companies(&mut conn, 3).expect("drain companies"),
            0
        );
    }
}
