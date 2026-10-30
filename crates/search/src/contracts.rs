use serde::{Deserialize, Serialize};

pub use crate::result_contract_generated::{
    CompanyInfo, CompanyRow, DocInfo, DocumentRow, OrgInfo, PersonInfo, PhoneInfo, RoleInfo,
    SearchResult,
};

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub intent: SearchIntent,
    pub query: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum SearchIntent {
    People,
    Companies,
    Mixed,
}

fn default_limit() -> usize {
    20
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub count: usize,
}
