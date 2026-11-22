-- Prevent a rejected/applied candidate from being reused after a concurrent review.
CREATE TRIGGER source_candidate_final_status BEFORE UPDATE OF status ON source_candidates
WHEN OLD.status<>'pending' AND NEW.status<>OLD.status
BEGIN SELECT RAISE(ABORT,'candidate_already_reviewed'); END;
CREATE TRIGGER operations_audit_no_update BEFORE UPDATE ON operations_audit
BEGIN SELECT RAISE(ABORT,'immutable_operations_audit'); END;
CREATE TRIGGER operations_audit_no_delete BEFORE DELETE ON operations_audit
BEGIN SELECT RAISE(ABORT,'immutable_operations_audit'); END;
CREATE TRIGGER review_audit_no_update BEFORE UPDATE ON website_review_logs
BEGIN SELECT RAISE(ABORT,'immutable_review_audit'); END;
CREATE TRIGGER review_audit_no_delete BEFORE DELETE ON website_review_logs
BEGIN SELECT RAISE(ABORT,'immutable_review_audit'); END;
