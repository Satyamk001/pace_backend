-- Migration: add painkiller_count column to health_metrics
ALTER TABLE health_metrics
  ADD COLUMN IF NOT EXISTS painkiller_count INTEGER DEFAULT 0;
