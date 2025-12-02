"""
2D Floorplan generation from RoomPlan 3D JSON data.

This module processes iOS ARKit RoomPlan JSON (containing 3D room scan data)
and generates a 2D floorplan visualization as SVG.
"""
import json
import logging
from typing import Dict, List, Tuple, Optional

logger = logging.getLogger(__name__)


def generate_2d_floorplan_svg(roomplan_json: Dict) -> str:
    """
    Generate 2D floorplan SVG from RoomPlan 3D JSON data.

    Args:
        roomplan_json: Parsed RoomPlan JSON dictionary with sections, walls, doors, objects

    Returns:
        SVG string representing the 2D floorplan

    Process:
    1. Extract floor boundary from floors array
    2. Extract doors and windows positions
    3. Extract furniture/object positions
    4. Compute bounding box and scale
    5. Render SVG with rooms, doors, windows, furniture
    """
    try:
        # Extract floor boundary
        floor_points = _extract_floor_boundary(roomplan_json)
        if not floor_points:
            logger.warning("No floor boundary found, using fallback")
            floor_points = [(0, 0), (5, 0), (5, 5), (0, 5)]

        # Extract room sections
        sections = roomplan_json.get('sections', [])

        # Extract doors
        doors = _extract_doors(roomplan_json)

        # Extract windows
        windows = _extract_windows(roomplan_json)

        # Extract furniture/objects
        objects = _extract_objects(roomplan_json)

        # Compute bounding box and scale
        bbox = _compute_bounding_box(floor_points, objects)

        # Generate SVG
        svg = _render_svg(floor_points, sections, doors, windows, objects, bbox)

        return svg

    except Exception as e:
        logger.error(f"Error generating floorplan SVG: {e}", exc_info=True)
        # Return fallback SVG
        return _generate_fallback_svg()


def _extract_floor_boundary(roomplan_json: Dict) -> List[Tuple[float, float]]:
    """
    Extract 2D floor boundary points from RoomPlan JSON.

    RoomPlan JSON structure:
    - floors[0].polygonCorners: Array of [x, y, z] vertices
    - We extract x, y and ignore z (vertical)
    """
    try:
        floors = roomplan_json.get('floors', [])
        if not floors:
            return []

        # Get first floor (story 0)
        floor = floors[0]
        polygon_corners = floor.get('polygonCorners', [])

        # Convert 3D points to 2D (x, y)
        points_2d = []
        for corner in polygon_corners:
            if len(corner) >= 2:
                x, y = corner[0], corner[1]
                points_2d.append((x, y))

        return points_2d

    except Exception as e:
        logger.error(f"Error extracting floor boundary: {e}")
        return []


def _extract_doors(roomplan_json: Dict) -> List[Dict]:
    """Extract door positions and dimensions."""
    doors = []
    try:
        for door in roomplan_json.get('doors', []):
            # Extract position from transform matrix (last row: x, y, z, w)
            transform = door.get('transform', [])
            if len(transform) >= 12:
                x, y = transform[12], transform[13]
                dimensions = door.get('dimensions', [0, 0, 0])
                width = dimensions[0] if dimensions else 0.8

                doors.append({
                    'x': x,
                    'y': y,
                    'width': width,
                    'isOpen': door.get('category', {}).get('door', {}).get('isOpen', False)
                })
    except Exception as e:
        logger.error(f"Error extracting doors: {e}")

    return doors


def _extract_windows(roomplan_json: Dict) -> List[Dict]:
    """Extract window positions and dimensions."""
    windows = []
    try:
        for window in roomplan_json.get('windows', []):
            transform = window.get('transform', [])
            if len(transform) >= 12:
                x, y = transform[12], transform[13]
                dimensions = window.get('dimensions', [0, 0, 0])
                width = dimensions[0] if dimensions else 1.0

                windows.append({
                    'x': x,
                    'y': y,
                    'width': width
                })
    except Exception as e:
        logger.error(f"Error extracting windows: {e}")

    return windows


def _extract_objects(roomplan_json: Dict) -> List[Dict]:
    """Extract furniture and object positions."""
    objects_list = []
    try:
        for obj in roomplan_json.get('objects', []):
            # Extract position from transform matrix
            transform = obj.get('transform', [])
            if len(transform) >= 12:
                x, y = transform[12], transform[13]
                dimensions = obj.get('dimensions', [0, 0, 0])
                width = dimensions[0] if dimensions else 0.5
                depth = dimensions[2] if len(dimensions) > 2 else 0.5

                # Get object category
                category = obj.get('category', {})
                obj_type = next(iter(category.keys())) if category else 'unknown'

                objects_list.append({
                    'x': x,
                    'y': y,
                    'width': width,
                    'depth': depth,
                    'type': obj_type
                })
    except Exception as e:
        logger.error(f"Error extracting objects: {e}")

    return objects_list


def _compute_bounding_box(floor_points: List[Tuple[float, float]],
                         objects: List[Dict]) -> Tuple[float, float, float, float]:
    """
    Compute bounding box for all points.

    Returns: (min_x, min_y, max_x, max_y)
    """
    if not floor_points:
        return (0, 0, 5, 5)

    xs = [p[0] for p in floor_points]
    ys = [p[1] for p in floor_points]

    # Include objects in bounding box
    for obj in objects:
        xs.append(obj['x'])
        ys.append(obj['y'])

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    # Add 10% padding
    padding_x = (max_x - min_x) * 0.1
    padding_y = (max_y - min_y) * 0.1

    return (
        min_x - padding_x,
        min_y - padding_y,
        max_x + padding_x,
        max_y + padding_y
    )


def _render_svg(floor_points: List[Tuple[float, float]],
               sections: List[Dict],
               doors: List[Dict],
               windows: List[Dict],
               objects: List[Dict],
               bbox: Tuple[float, float, float, float]) -> str:
    """Render SVG markup for the floorplan."""

    min_x, min_y, max_x, max_y = bbox
    width = max_x - min_x
    height = max_y - min_y

    # SVG dimensions (pixels)
    svg_width = 800
    svg_height = int(800 * (height / width)) if width > 0 else 800

    # Scale factor
    scale_x = svg_width / width if width > 0 else 1
    scale_y = svg_height / height if height > 0 else 1

    def transform_point(x: float, y: float) -> Tuple[float, float]:
        """Transform real-world coords to SVG coords."""
        svg_x = (x - min_x) * scale_x
        svg_y = (y - min_y) * scale_y
        return (svg_x, svg_y)

    # Build SVG
    svg_parts = []
    svg_parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" '
                    f'width="{svg_width}" height="{svg_height}" '
                    f'viewBox="0 0 {svg_width} {svg_height}">')

    # Background
    svg_parts.append(f'<rect width="{svg_width}" height="{svg_height}" fill="#FCF7F4"/>')

    # Floor polygon
    if floor_points:
        points_str = ' '.join([f'{transform_point(x, y)[0]},{transform_point(x, y)[1]}'
                              for x, y in floor_points])
        svg_parts.append(f'<polygon points="{points_str}" '
                        f'fill="white" stroke="#191919" stroke-width="2"/>')

    # Room section labels
    for section in sections:
        center = section.get('center', [])
        if len(center) >= 2:
            x, y = center[0], center[1]
            svg_x, svg_y = transform_point(x, y)
            label = section.get('label', 'room')
            # Format label (camelCase to Title Case)
            label_formatted = ''.join([' ' + c if c.isupper() else c for c in label]).strip()
            label_formatted = label_formatted.title()

            svg_parts.append(f'<circle cx="{svg_x}" cy="{svg_y}" r="3" fill="#349552"/>')
            svg_parts.append(f'<text x="{svg_x}" y="{svg_y - 10}" '
                           f'text-anchor="middle" font-family="sans-serif" '
                           f'font-size="14" fill="#191919">{label_formatted}</text>')

    # Doors
    for door in doors:
        svg_x, svg_y = transform_point(door['x'], door['y'])
        door_width = door['width'] * scale_x
        color = '#35B0FE' if door.get('isOpen') else '#F17F38'
        svg_parts.append(f'<rect x="{svg_x - door_width/2}" y="{svg_y - 5}" '
                        f'width="{door_width}" height="10" '
                        f'fill="{color}" stroke="#191919" stroke-width="1"/>')

    # Windows
    for window in windows:
        svg_x, svg_y = transform_point(window['x'], window['y'])
        win_width = window['width'] * scale_x
        svg_parts.append(f'<rect x="{svg_x - win_width/2}" y="{svg_y - 3}" '
                        f'width="{win_width}" height="6" '
                        f'fill="#07C0C3" stroke="#191919" stroke-width="1"/>')

    # Furniture/Objects
    for obj in objects:
        svg_x, svg_y = transform_point(obj['x'], obj['y'])
        obj_width = obj['width'] * scale_x
        obj_depth = obj['depth'] * scale_y
        obj_type = obj['type']

        # Color based on object type
        color = '#D9D9D9'  # default gray
        if obj_type in ['bed', 'sofa', 'chair']:
            color = '#E8F5E9'  # light green
        elif obj_type in ['table']:
            color = '#FFF3E0'  # light orange
        elif obj_type in ['storage', 'cabinet']:
            color = '#E3F2FD'  # light blue

        svg_parts.append(f'<rect x="{svg_x - obj_width/2}" y="{svg_y - obj_depth/2}" '
                        f'width="{obj_width}" height="{obj_depth}" '
                        f'fill="{color}" stroke="#191919" stroke-width="1"/>')

        # Label for larger objects
        if obj_width > 30:
            label = obj_type.capitalize()
            svg_parts.append(f'<text x="{svg_x}" y="{svg_y}" '
                           f'text-anchor="middle" font-family="sans-serif" '
                           f'font-size="10" fill="#191919">{label}</text>')

    svg_parts.append('</svg>')

    return '\n'.join(svg_parts)


def _generate_fallback_svg() -> str:
    """Generate a simple fallback SVG if processing fails."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#FCF7F4"/>
  <rect x="50" y="50" width="300" height="300" fill="white" stroke="#191919" stroke-width="2"/>
  <text x="200" y="200" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#191919">
    Room Floorplan
  </text>
  <text x="200" y="220" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#999">
    (Visualization unavailable)
  </text>
</svg>'''
