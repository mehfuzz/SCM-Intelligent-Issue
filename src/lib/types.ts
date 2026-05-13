export type Priority = "P0" | "P1" | "P2" | "P3";

export type TicketStage =
  | "draft"
  | "submitted"
  | "coe_triage"
  | "poc_assigned"
  | "requirement_clarification"
  | "brd_acceptance"
  | "solution_design"
  | "mih_ccb_approval"
  | "development_sit"
  | "uat"
  | "go_live"
  | "pending_validation"
  | "closed"
  | "reopened"
  | "rejected";

export interface TicketSummary {
  id: string;
  ticket_no: string;
  title: string;
  stage: TicketStage;
  priority: Priority | null;
  module_id: string | null;
  category_id: string | null;
  submitter_id: string;
  assigned_poc_id: string | null;
  created_at: string;
  resolution_due_at: string | null;
}
