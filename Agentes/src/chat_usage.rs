//! Per-inference usage ledger: survives harness compaction/reset of runtime metrics.
use serde_json::{Value, json};
use std::collections::HashMap;
// Observe runtime billing token categories, including cached input. Explicit
// model/compaction transitions are checkpointed on both sides, because some
// CLI versions reset input/cache counters but retain output and credit totals.
#[derive(Default)]
pub struct TokenCounters {
    values: HashMap<String, (u64, u64)>,
    incomplete: bool,
}
impl TokenCounters {
    pub fn invalidate(&mut self) {
        self.incomplete = true;
    }
    pub fn record(&mut self, metrics: &Value) -> Value {
        let details = &metrics["tokenDetails"];
        let mut available = !self.incomplete;
        for key in ["input", "cache_read", "cache_write", "output"] {
            if let Some(now) = details[key]["tokenCount"].as_u64() {
                let (previous, total) = self.values.entry(key.into()).or_insert((0, 0));
                *total = total.saturating_add(if now >= *previous {
                    now - *previous
                } else {
                    now
                });
                *previous = now;
            } else {
                available = false;
            }
        }
        let total = |key: &str| self.values.get(key).map(|v| v.1).unwrap_or(0);
        json!({"inputTokens":available.then(||total("input").saturating_add(total("cache_read")).saturating_add(total("cache_write"))),"uncachedInputTokens":available.then(||total("input")),"cacheReadTokens":available.then(||total("cache_read")),"cacheWriteTokens":available.then(||total("cache_write")),"outputTokens":available.then(||total("output")),"source":"runtime-token-category-checkpoints"})
    }
}
#[derive(Default)]
pub struct Ledger {
    calls: HashMap<String, [Option<f64>; 4]>,
    incomplete: bool,
}
fn number(value: &Value) -> Option<f64> {
    value.as_f64().filter(|v| v.is_finite() && *v >= 0.0)
}
impl Ledger {
    pub fn record(&mut self, event: &Value) {
        if event["type"] != "assistant.usage" {
            return;
        }
        let data = &event["data"];
        let Some(id) = data["apiCallId"].as_str().or_else(|| event["id"].as_str()) else {
            self.incomplete = true;
            return;
        };
        if id.len() > 256 || (!self.calls.contains_key(id) && self.calls.len() >= 8192) {
            self.incomplete = true;
            return;
        }
        let value = [
            number(&data["copilotUsage"]["totalNanoAiu"]),
            number(&data["inputTokens"]),
            number(&data["outputTokens"]),
            number(&data["cost"]),
        ];
        let recorded = self.calls.entry(id.to_owned()).or_insert([None; 4]);
        for i in 0..4 {
            if value[i].is_some() {
                recorded[i] = value[i];
            }
        }
    }
    pub fn value(&self) -> Value {
        let sum = |i: usize| {
            if self.incomplete
                || self.calls.is_empty()
                || self.calls.values().any(|v| v[i].is_none())
            {
                None
            } else {
                Some(self.calls.values().filter_map(|v| v[i]).sum::<f64>())
            }
        };
        // Event.cost is a model multiplier, not a count of billed user requests.
        json!({"available":!self.calls.is_empty(),"totalNanoAiu":sum(0),"inputTokens":sum(1),"outputTokens":sum(2),"premiumRequests":null,"calls":self.calls.len(),"incomplete":self.incomplete,"source":"deduplicated-assistant.usage"})
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn category_checkpoints_include_cache_and_survive_mixed_counter_resets() {
        let metrics = |i, r, w, o| json!({"tokenDetails":{"input":{"tokenCount":i},"cache_read":{"tokenCount":r},"cache_write":{"tokenCount":w},"output":{"tokenCount":o}}});
        let mut counters = TokenCounters::default();
        assert_eq!(
            counters.record(&metrics(15, 67004, 17114, 575))["inputTokens"],
            84133
        );
        assert_eq!(
            counters.record(&metrics(15, 67004, 17114, 575))["outputTokens"],
            575
        );
        // Model-switch checkpoint: input counters reset; output retains total.
        counters.record(&metrics(0, 0, 0, 575));
        let second = counters.record(&metrics(6, 0, 25507, 695));
        assert_eq!(second["inputTokens"], 109646);
        assert_eq!(second["outputTokens"], 695);
        assert_eq!(counters.record(&metrics(6, 0, 25507, 695)), second);
        assert_eq!(counters.record(&json!({}))["inputTokens"], Value::Null);
    }
    #[test]
    fn sums_calls_not_snapshots_keeps_duplicate_updates_once_and_never_invents_cost() {
        let mut ledger = Ledger::default();
        assert_eq!(ledger.value()["totalNanoAiu"], Value::Null);
        let first = json!({"type":"assistant.usage","id":"one","data":{"apiCallId":"api-one","inputTokens":50,"outputTokens":10,"cost":1,"copilotUsage":{"totalNanoAiu":500}}});
        ledger.record(&first);
        ledger.record(&first);
        ledger.record(&json!({"type":"assistant.usage","id":"retry-event","data":{"apiCallId":"api-one","inputTokens":50,"outputTokens":10}}));
        ledger.record(&json!({"type":"assistant.usage","id":"two","data":{"inputTokens":20,"outputTokens":5,"cost":0,"copilotUsage":{"totalNanoAiu":100}}}));
        assert_eq!(ledger.value()["inputTokens"], 70.0);
        assert_eq!(ledger.value()["totalNanoAiu"], 600.0);
        assert_eq!(ledger.value()["calls"], 2);
        ledger.record(&json!({"type":"assistant.usage","id":"missing","data":{"inputTokens":10,"outputTokens":1}}));
        assert_eq!(ledger.value()["inputTokens"], 80.0);
        assert_eq!(ledger.value()["totalNanoAiu"], Value::Null);
    }
}
