-- Migration: Add floorplan SVG fields to floorplans table
-- Created: 2025-12-02
-- Description: Adds floorplan_svg and floorplan_svg_url columns to store 2D floorplan visualizations

-- Add floorplan_svg column (stores SVG markup directly)
alter table public.floorplans
  add column if not exists floorplan_svg text;

-- Add floorplan_svg_url column (optional: URL to SVG file in media storage)
alter table public.floorplans
  add column if not exists floorplan_svg_url text;

-- Add comment to document the columns
comment on column public.floorplans.floorplan_svg is 'SVG markup for 2D floorplan visualization generated from RoomPlan 3D data';
comment on column public.floorplans.floorplan_svg_url is 'Optional URL to SVG file stored in Django media storage';
