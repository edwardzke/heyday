"""Utilities to derive a simple 2D floorplan from a scanned mesh."""
from __future__ import annotations

from typing import Iterable

from django.core.files.base import ContentFile

from .models import RoomScanSession, ScanArtifact, generate_upload_token


def _convex_hull(points: Iterable[tuple[float, float]]) -> list[tuple[float, float]]:
    """Return the 2D convex hull for the given points using a monotonic chain."""
    pts = sorted(set(points))
    if len(pts) <= 1:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper: list[tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def _mesh_vertices_xy(mesh) -> list[tuple[float, float]]:
    """Extract XY coordinates from a mesh, prioritizing floor-level points."""
    verts = mesh.vertices  # numpy array (n, 3)
    if verts.size == 0:
        return []

    import numpy as np  # type: ignore

    # Use lowest quartile of z-values to bias toward floor footprint.
    z_vals = verts[:, 2]
    floor_threshold = np.quantile(z_vals, 0.25)
    floor_points = verts[z_vals <= floor_threshold + 0.05][:, :2]
    if floor_points.shape[0] < 4:
        floor_points = verts[:, :2]

    return [(float(x), float(y)) for x, y in floor_points]


def _render_svg(points: list[tuple[float, float]], pad_px: int = 16, target_px: int = 480) -> str:
    """Render a minimal SVG polygon representing the supplied footprint."""
    if not points:
        return '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"></svg>'

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width = max(max_x - min_x, 1e-3)
    height = max(max_y - min_y, 1e-3)
    scale = (target_px - 2 * pad_px) / max(width, height)

    def normalize(point: tuple[float, float]) -> tuple[float, float]:
        nx = (point[0] - min_x) * scale + pad_px
        ny = (point[1] - min_y) * scale + pad_px
        # Flip Y for display so top-down is upright.
        return (nx, (target_px - pad_px) - (ny - pad_px))

    normalized = [normalize(p) for p in hull]
    points_attr = " ".join(f"{x:.2f},{y:.2f}" for x, y in normalized)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{target_px}" height="{target_px}" viewBox="0 0 {target_px} {target_px}">
  <rect width="100%" height="100%" fill="#f7faf7" stroke="#d9e7df" stroke-width="1" />
  <polygon points="{points_attr}" fill="rgba(11,77,38,0.16)" stroke="#0b4d26" stroke-width="2" />
</svg>
"""
    return svg


def generate_floorplan(session: RoomScanSession) -> ScanArtifact:
    """
    Convert a room scan mesh into a top-down floorplan SVG.

    Depends on `trimesh` (and numpy). Looks for a processed mesh, falls back to raw.
    """
    mesh_artifact = (
        session.artifacts.filter(kind=ScanArtifact.Kind.PROCESSED_MESH).first()
        or session.artifacts.filter(kind=ScanArtifact.Kind.RAW_MESH).first()
    )
    if not mesh_artifact or not mesh_artifact.file:
        raise ValueError("No mesh artifact available for this session.")

    try:
        import trimesh  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "trimesh is required to generate floorplans. Install with `pip install trimesh`."
        ) from exc

    mesh = trimesh.load(mesh_artifact.file.path)
    points_xy = _mesh_vertices_xy(mesh)
    hull = _convex_hull(points_xy)
    svg = _render_svg(hull)

    upload_token = generate_upload_token()
    artifact = ScanArtifact.objects.create(
        session=session,
        kind=ScanArtifact.Kind.FLOORPLAN,
        upload_token=upload_token,
        status=ScanArtifact.Status.COMPLETE,
    )
    artifact.file.save(f"{upload_token}.svg", ContentFile(svg.encode("utf-8")), save=True)
    artifact.bytes = artifact.file.size or 0
    artifact.content_type = "image/svg+xml"
    artifact.save(update_fields=["bytes", "content_type", "updated_at"])
    return artifact


def generate_floorplan_from_points(
    session: RoomScanSession, points: list[tuple[float, float]], scale: float = 1.0
) -> ScanArtifact:
    """Create a floorplan artifact from user-supplied 2D coordinates preserving point order."""
    if len(points) < 3:
        raise ValueError("At least three points are required to form a floorplan.")
    scaled_points = [(x * scale, y * scale) for x, y in points]
    svg = _render_svg(scaled_points)

    upload_token = generate_upload_token()
    artifact = ScanArtifact.objects.create(
        session=session,
        kind=ScanArtifact.Kind.FLOORPLAN,
        upload_token=upload_token,
        status=ScanArtifact.Status.COMPLETE,
    )
    artifact.file.save(f"{upload_token}.svg", ContentFile(svg.encode("utf-8")), save=True)
    artifact.bytes = artifact.file.size or 0
    artifact.content_type = "image/svg+xml"
    artifact.save(update_fields=["bytes", "content_type", "updated_at"])
    return artifact
