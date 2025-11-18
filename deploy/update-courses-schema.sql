-- Migration: Add unique constraints and policies for course data
-- Run this in Supabase SQL Editor

-- Add unique constraint to external_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'courses_external_id_key'
    ) THEN
        ALTER TABLE courses ADD CONSTRAINT courses_external_id_key UNIQUE (external_id);
    END IF;
END $$;

-- Add missing unique constraint to course_tees
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'course_tees_course_id_tee_name_key'
    ) THEN
        ALTER TABLE course_tees ADD CONSTRAINT course_tees_course_id_tee_name_key UNIQUE (course_id, tee_name);
    END IF;
END $$;

-- Add par_total column to course_tees if it doesn't exist
ALTER TABLE course_tees ADD COLUMN IF NOT EXISTS par_total int;

-- Add write policies for authenticated users
DROP POLICY IF EXISTS "courses_authenticated_write" ON courses;
CREATE POLICY "courses_authenticated_write" ON courses FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "courses_authenticated_update" ON courses;
CREATE POLICY "courses_authenticated_update" ON courses FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "course_tees_authenticated_write" ON course_tees;
CREATE POLICY "course_tees_authenticated_write" ON course_tees FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "course_tees_authenticated_update" ON course_tees;
CREATE POLICY "course_tees_authenticated_update" ON course_tees FOR UPDATE USING (true) WITH CHECK (true);
