-- Perf: dom_samples lookup by hostname (getDomGrounding + batched dom_sample_id resolve in getBacklinkTasks).
-- Trước đây view `backlinks` tính dom_sample_id bằng subquery tương quan per-row (seq-scan dom_samples mỗi
-- dòng task → O(task×dom_samples), đo được ~110ms/49 dòng). getBacklinkTasks đã chuyển sang batch-resolve
-- (1 query DISTINCT ON hostname). Index này phục vụ batch query + getDomGrounding khi dom_samples lớn dần.
CREATE INDEX IF NOT EXISTS dom_samples_hostname_idx ON dom_samples (hostname);
