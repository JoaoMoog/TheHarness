//! Track only successful main-agent task_complete, not sub-agent completion.
use serde_json::{Value, json};
use std::collections::HashMap;

#[derive(Default)]
pub struct Flow {
    tasks: HashMap<String, String>,
    pub completed: bool,
}
impl Flow {
    pub fn record(&mut self, event: &Value) -> Option<Value> {
        let d = &event["data"];
        match event["type"].as_str()? {
            "user.message" => {
                self.tasks.clear();
                self.completed = false;
            }
            "tool.execution_start"
                if d["toolName"] == "task_complete" && d["parentToolCallId"].is_null() =>
            {
                if self.tasks.len() < 128 {
                    self.tasks.insert(
                        d["toolCallId"].as_str()?.into(),
                        d["arguments"]["summary"].as_str().unwrap_or("").into(),
                    );
                }
            }
            "tool.execution_complete" => {
                let summary = self.tasks.remove(d["toolCallId"].as_str()?)?;
                if d["success"] == true && d["parentToolCallId"].is_null() {
                    self.completed = true;
                    let text = d["result"]["content"]
                        .as_str()
                        .filter(|s| !s.trim().is_empty())
                        .unwrap_or(&summary);
                    return Some(json!({"type":"bridge.task_complete","data":{"summary":text}}));
                }
            }
            _ => {}
        }
        None
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_successful_main_task_finishes_and_next_prompt_resets() {
        let mut f = Flow::default();
        for (parent, success) in [
            (json!("sub"), true),
            (Value::Null, false),
            (Value::Null, true),
        ] {
            f.record(&json!({"type":"tool.execution_start","data":{"toolName":"task_complete","toolCallId":"id","parentToolCallId":parent,"arguments":{"summary":"Done"}}}));
            let result = f.record(&json!({"type":"tool.execution_complete","data":{"toolCallId":"id","success":success,"parentToolCallId":parent}}));
            assert_eq!(result.is_some(), parent.is_null() && success);
        }
        assert!(f.completed);
        f.record(&json!({"type":"user.message","data":{}}));
        assert!(!f.completed);
    }
}
