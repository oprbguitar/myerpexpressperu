drop table if exists workflow_simulations, workflow_executions, workflow_rule_versions,
  workflow_rules, geographical_aggregates, geocoding_attempts, geo_locations,
  ai_incidents, ai_usage_budgets, ai_feedback, ai_tool_calls, ai_interactions,
  ai_prompt_template_versions, ai_prompt_templates, ai_policies,
  ai_provider_configurations, ai_providers, ocr_corrections, ocr_extracted_fields,
  ocr_extractions, ocr_job_pages, ocr_jobs cascade;
drop function if exists prevent_phase3_history_mutation();
