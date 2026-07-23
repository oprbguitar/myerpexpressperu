drop table if exists asset_incidents, meter_readings, maintenance_costs, maintenance_parts,
  maintenance_tasks, maintenance_work_orders, maintenance_schedules, maintenance_plans,
  asset_status_history, asset_assignments, assets, asset_locations, asset_categories,
  sst_committee_records, work_restrictions, occupational_fitness,
  occupational_exam_medical_details, occupational_exams, sst_accidents,
  sst_corrective_actions, sst_incidents, sst_ppe_deliveries, sst_ppe_items,
  sst_training_attendance, sst_training_sessions, sst_inspection_findings,
  sst_inspections, sst_control_measures, sst_risk_assessments, sst_risks, sst_hazards,
  employee_status_history, employee_certifications, employee_trainings,
  attendance_records, employee_vacations, employee_leaves, employee_benefits,
  employee_emergency_contacts, employee_documents, employee_assignments,
  employee_positions, employment_contracts, employees cascade;
drop function if exists app_has_medical_access();
