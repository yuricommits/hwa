package main

import (
	supabase "github.com/supabase-community/supabase-go"
	"github.com/yuricommits/hwa/analysis-engine/internal/runner"
)

func runScan(db *supabase.Client, scanID string) error {
	return runner.RunScan(db, scanID)
}
