use crate::PipelineError;
use crate::config::manifest::{
    ManifestInputPolicy, ManifestLocation, SourceManifestEntry, verify_manifest_with_policy,
};
use crate::config::mapping::SourceMapping;
use crate::normalize::{self, PhoneKind, hash_record, normalize_phone_with_kind};
use std::fs;
use std::path::Path;

#[derive(Default, serde::Serialize)]
struct NormalizationSummary {
    source_key: String,
    snapshot_label: String,
    reliability_rank: i64,
    total_rows: usize,
    normalized_rows: usize,
    error_rows: usize,
    invalid_doc_rows: usize,
    invalid_ruc_rows: usize,
    invalid_phone_rows: usize,
    empty_payload_rows: usize,
    mobile_phone_rows: usize,
    fixed_phone_rows: usize,
}

pub fn normalize_matrix(
    manifest: ManifestLocation<'_>,
    row_cap: usize,
    out_dir: &str,
) -> Result<(), PipelineError> {
    normalize_matrix_with_policy(
        manifest,
        row_cap,
        out_dir,
        ManifestInputPolicy::RequireRawInputs,
    )
}

pub fn normalize_matrix_for_checkout(
    manifest: ManifestLocation<'_>,
    row_cap: usize,
    out_dir: &str,
) -> Result<(), PipelineError> {
    normalize_matrix_with_policy(
        manifest,
        row_cap,
        out_dir,
        ManifestInputPolicy::AllowMissingOptionalRawInputs,
    )
}

fn normalize_matrix_with_policy(
    manifest_location: ManifestLocation<'_>,
    row_cap: usize,
    out_dir: &str,
    input_policy: ManifestInputPolicy,
) -> Result<(), PipelineError> {
    let manifest = verify_manifest_with_policy(manifest_location, input_policy)?;

    for source in &manifest.sources {
        if !source.enabled {
            continue;
        }
        if !source.has_raw_input() {
            eprintln!(
                "[pipeline] warning: optional raw source skipped source={} path={}",
                source.source_key, source.raw_path
            );
            continue;
        }
        normalize_source_entry(source, row_cap, out_dir)?;
    }
    Ok(())
}

fn normalize_source_entry(
    source: &SourceManifestEntry,
    row_cap: usize,
    out_dir: &str,
) -> Result<(), PipelineError> {
    let mapping = SourceMapping::from_path(&source.mapping_path)?;
    let target_dir = Path::new(out_dir)
        .join(&source.source_key)
        .join(&source.snapshot_label);
    fs::create_dir_all(&target_dir)?;

    let normalized_path = target_dir.join("normalized.part-00001.csv");
    let errors_path = target_dir.join("errors.csv");
    let summary_path = target_dir.join("summary.json");

    let mut normalized_writer = csv::WriterBuilder::new()
        .has_headers(true)
        .from_path(&normalized_path)?;
    let mut error_writer = csv::WriterBuilder::new()
        .has_headers(true)
        .from_path(&errors_path)?;

    normalized_writer.write_record([
        "source_key",
        "snapshot_label",
        "snapshot_date",
        "source_row_number",
        "record_hash",
        "person_dni",
        "person_natural_ruc",
        "person_full_name",
        "email",
        "company_ruc",
        "company_name",
        "rep_doc_type",
        "rep_doc_number",
        "rep_name",
        "role_name",
        "role_start_date",
        "phone",
        "phone_type",
    ])?;
    error_writer.write_record([
        "source_key",
        "snapshot_label",
        "source_row_number",
        "error_code",
        "error_detail",
        "raw_payload",
    ])?;

    let mut reader = mapping.reader(&source.raw_path)?;

    let headers = if mapping.has_header {
        let byte_headers = reader.byte_headers()?.clone();
        Some(mapping.decode_byte_record(&byte_headers)?)
    } else {
        None
    };
    let resolved_mapping = normalize::resolve_mapping(&mapping, headers.as_ref())?;

    let mut summary = NormalizationSummary {
        source_key: source.source_key.clone(),
        snapshot_label: source.snapshot_label.clone(),
        reliability_rank: mapping.reliability_rank,
        ..NormalizationSummary::default()
    };

    for (row_idx, row_result) in reader.byte_records().enumerate() {
        if row_idx >= row_cap {
            break;
        }
        let source_row_number = row_idx + 1;

        let byte_record = match row_result {
            Ok(record) => record,
            Err(err) => {
                summary.total_rows += 1;
                summary.error_rows += 1;
                error_writer.write_record([
                    source.source_key.as_str(),
                    source.snapshot_label.as_str(),
                    &source_row_number.to_string(),
                    "csv_parse_error",
                    &err.to_string(),
                    "",
                ])?;
                continue;
            }
        };
        let record = match mapping.decode_byte_record(&byte_record) {
            Ok(record) => record,
            Err(err) => {
                summary.total_rows += 1;
                summary.error_rows += 1;
                error_writer.write_record([
                    source.source_key.as_str(),
                    source.snapshot_label.as_str(),
                    &source_row_number.to_string(),
                    "csv_parse_error",
                    &err.to_string(),
                    "",
                ])?;
                continue;
            }
        };

        summary.total_rows += 1;
        let record_hash = hash_record(&record, mapping.delimiter.as_str());
        let row = normalize::normalize_row(&resolved_mapping, &record);

        let mut errors: Vec<&str> = Vec::new();
        let has_invalid_rep_doc = row.had_rep_doc_input && row.rep_doc_type.is_empty();
        let has_invalid_person_doc = row.had_person_doc_input && row.person_dni.is_none();
        if has_invalid_rep_doc || has_invalid_person_doc {
            summary.invalid_doc_rows += 1;
            errors.push("invalid_doc");
        }
        if row.had_company_ruc_input && row.company_ruc.is_none() {
            summary.invalid_ruc_rows += 1;
            errors.push("invalid_ruc");
        }
        let mut invalid_phone_detail = String::new();
        if row.had_phone_input && row.phones.is_empty() {
            summary.invalid_phone_rows += 1;
            errors.push("invalid_phone");
            invalid_phone_detail = row.invalid_phone_reasons.join(";");
        }

        let has_any_payload = row.person_dni.is_some()
            || row.company_ruc.is_some()
            || !row.person_full_name.is_empty()
            || !row.company_name.is_empty()
            || !row.rep_doc_type.is_empty()
            || !row.rep_doc_number.is_empty()
            || !row.rep_name.is_empty()
            || !row.role_name.is_empty()
            || !row.phones.is_empty();

        if !has_any_payload {
            summary.empty_payload_rows += 1;
            errors.push("empty_payload");
        }

        if !errors.is_empty() {
            summary.error_rows += 1;
            let raw_payload = render_record_payload(&record, mapping.delimiter.as_str());
            error_writer.write_record([
                source.source_key.as_str(),
                source.snapshot_label.as_str(),
                &source_row_number.to_string(),
                &errors.join(";"),
                &invalid_phone_detail,
                &raw_payload,
            ])?;
        }

        if has_any_payload {
            if row.phones.is_empty() {
                normalized_writer.write_record([
                    source.source_key.as_str(),
                    source.snapshot_label.as_str(),
                    source.snapshot_date.as_str(),
                    &source_row_number.to_string(),
                    &record_hash,
                    row.person_dni.as_deref().unwrap_or(""),
                    row.person_natural_ruc.as_deref().unwrap_or(""),
                    &row.person_full_name,
                    row.email.as_deref().unwrap_or(""),
                    row.company_ruc.as_deref().unwrap_or(""),
                    &row.company_name,
                    &row.rep_doc_type,
                    &row.rep_doc_number,
                    &row.rep_name,
                    &row.role_name,
                    &row.role_start_date,
                    "",
                    "",
                ])?;
                summary.normalized_rows += 1;
            } else {
                for phone in row.phones {
                    let phone_type = match normalize_phone_with_kind(&phone) {
                        Some((_, PhoneKind::Mobile)) => {
                            summary.mobile_phone_rows += 1;
                            "mobile"
                        }
                        Some((_, PhoneKind::Fixed)) => {
                            summary.fixed_phone_rows += 1;
                            "fixed"
                        }
                        None => "",
                    };
                    normalized_writer.write_record([
                        source.source_key.as_str(),
                        source.snapshot_label.as_str(),
                        source.snapshot_date.as_str(),
                        &source_row_number.to_string(),
                        &record_hash,
                        row.person_dni.as_deref().unwrap_or(""),
                        row.person_natural_ruc.as_deref().unwrap_or(""),
                        &row.person_full_name,
                        row.email.as_deref().unwrap_or(""),
                        row.company_ruc.as_deref().unwrap_or(""),
                        &row.company_name,
                        &row.rep_doc_type,
                        &row.rep_doc_number,
                        &row.rep_name,
                        &row.role_name,
                        &row.role_start_date,
                        &phone,
                        phone_type,
                    ])?;
                    summary.normalized_rows += 1;
                }
            }
        }
    }

    normalized_writer.flush()?;
    error_writer.flush()?;
    fs::write(summary_path, serde_json::to_string_pretty(&summary)?)?;
    println!("{}", serde_json::to_string(&summary)?);
    Ok(())
}

fn render_record_payload(record: &csv::StringRecord, delimiter: &str) -> String {
    let mut payload = String::new();
    let mut iter = record.iter();
    if let Some(first) = iter.next() {
        payload.push_str(first);
    }
    for field in iter {
        payload.push_str(delimiter);
        payload.push_str(field);
    }
    payload
}
