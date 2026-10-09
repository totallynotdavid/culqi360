use std::collections::HashMap;

use super::row::FieldValues;

/// Applies source-specific vocabulary translations to extracted field values.
/// Currently only translates `rep_doc_type` via the per-source `doc_type_map`.
///
/// A source that uses "01" for DNI declares `"doc_type_map": {"01": "DNI"}` in its
/// JSON mapping. After this step, `rep_doc_type` is in canonical vocabulary and
/// normalization has no awareness of the original source encoding.
pub(super) fn apply(mut raw: FieldValues, doc_type_map: &HashMap<String, String>) -> FieldValues {
    if !doc_type_map.is_empty() && !raw.rep_doc_type.is_empty() {
        let key = raw.rep_doc_type.to_ascii_uppercase();
        if let Some(canonical) = doc_type_map.get(&key) {
            raw.rep_doc_type = canonical.clone();
        }
    }
    raw
}
