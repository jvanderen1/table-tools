#!/usr/bin/env python3
"""Gary Grapplesauce — stylized miniature generator.

The STL files named gary-grapplesauce-32mm and gary-grapplesauce-54mm are a
full figure reconstructed from the front, back, left, and right pose images.
This script builds the earlier simplified figure and writes it beside them,
so running it does not replace that mesh.

Units are millimeters. Z is up, the nose points +Y, +X is Gary's right
(the left side of the portrait).

  python3 prints/gary-grapplesauce/sculpt.py preview
  python3 prints/gary-grapplesauce/sculpt.py mesh
"""

from __future__ import annotations

import base64
import struct
import sys
import time
import zlib
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
CROWN_Z = 35.2  # grid limit above the head; the crown itself lands near 34 mm
BASE_RADIUS = 12.7  # 1 inch diameter
# Belt sits in a channel at the waist. R is the centerline radius.
BELT_C = (0.0, 0.30, 15.40)
BELT_R = 5.75
BELT_T = 0.92

# Marching-cubes triangle table (Lorensen / PyMCubes), 256 x 16 int8.
_TRI_B64 = """
/////////////////////wAIA/////////////////8AAQn/////////////////AQgDCQgB/////////////wECCv////////////////8ACAMBAgr/////////////CQIKAAIJ/////////////wIIAwIKCAoJCP////////8DCwL/////////////////AAsCCAsA/////////////wEJAAIDC/////////////8BCwIBCQsJCAv/////////AwoBCwoD/////////////wAKAQAICggLCv////////8DCQADCwkLCgn/////////CQgKCggL/////////////wQHCP////////////////8EAwAHAwT/////////////AAEJCAQH/////////////wQBCQQHAQcDAf////////8BAgoIBAf/////////////AwQHAwAEAQIK/////////wkCCgkAAggEB/////////8CCgkCCQcCBwMHCQT/////CAQHAwsC/////////////wsEBwsCBAIABP////////8JAAEIBAcCAwv/////////BAcLCQQLCQsCCQIB/////wMKAQMLCgcIBP////////8BCwoBBAsBAAQHCwT/////BAcICQALCQsKCwAD/////wQHCwQLCQkLCv////////8JBQT/////////////////CQUEAAgD/////////////wAFBAEFAP////////////8IBQQIAwUDAQX/////////AQIKCQUE/////////////wMACAECCgQJBf////////8FAgoFBAIEAAL/////////AgoFAwIFAwUEAwQI/////wkFBAIDC/////////////8ACwIACAsECQX/////////AAUEAAEFAgML/////////wIBBQIFCAIICwQIBf////8KAwsKAQMJBQT/////////BAkFAAgBCAoBCAsK/////wUEAAUACwULCgsAA/////8FBAgFCAoKCAv/////////CQcIBQcJ/////////////wkDAAkFAwUHA/////////8ABwgAAQcBBQf/////////AQUDAwUH/////////////wkHCAkFBwoBAv////////8KAQIJBQAFAwAFBwP/////CAACCAIFCAUHCgUC/////wIKBQIFAwMFB/////////8HCQUHCAkDCwL/////////CQUHCQcCCQIAAgcL/////wIDCwABCAEHCAEFB/////8LAgELAQcHAQX/////////CQUICAUHCgEDCgML/////wUHAAUACQcLAAEACgsKAP8LCgALAAMKBQAIAAcFBwD/CwoFBwsF/////////////woGBf////////////////8ACAMFCgb/////////////CQABBQoG/////////////wEIAwEJCAUKBv////////8BBgUCBgH/////////////AQYFAQIGAwAI/////////wkGBQkABgACBv////////8FCQgFCAIFAgYDAgj/////AgMLCgYF/////////////wsACAsCAAoGBf////////8AAQkCAwsFCgb/////////BQoGAQkCCQsCCQgL/////wYDCwYFAwUBA/////////8ACAsACwUABQEFCwb/////AwsGAAMGAAYFAAUJ/////wYFCQYJCwsJCP////////8FCgYEBwj/////////////BAMABAcDBgUK/////////wEJAAUKBggEB/////////8KBgUBCQcBBwMHCQT/////BgECBgUBBAcI/////////wECBQUCBgMABAMEB/////8IBAcJAAUABgUAAgb/////BwMJBwkEAwIJBQkGAgYJ/wMLAgcIBAoGBf////////8FCgYEBwIEAgACBwv/////AAEJBAcIAgMLBQoG/////wkCAQkLAgkECwcLBAUKBv8IBAcDCwUDBQEFCwb/////BQELBQsGAQALBwsEAAQL/wAFCQAGBQADBgsGAwgEB/8GBQkGCQsEBwkHCwn/////CgQJBgQK/////////////wQKBgQJCgAIA/////////8KAAEKBgAGBAD/////////CAMBCAEGCAYEBgEK/////wEECQECBAIGBP////////8DAAgBAgkCBAkCBgT/////AAIEBAIG/////////////wgDAggCBAQCBv////////8KBAkKBgQLAgP/////////AAgCAggLBAkKBAoG/////wMLAgABBgAGBAYBCv////8GBAEGAQoECAECAQsICwH/CQYECQMGCQEDCwYD/////wgLAQgBAAsGAQkBBAYEAf8DCwYDBgAABgT/////////BgQICwYI/////////////wcKBgcICggJCv////////8ABwMACgcACQoGBwr/////CgYHAQoHAQcIAQgA/////woGBwoHAQEHA/////////8BAgYBBggBCAkIBgf/////AgYJAgkBBgcJAAkDBwMJ/wcIAAcABgYAAv////////8HAwIGBwL/////////////AgMLCgYICggJCAYH/////wIABwIHCwAJBwYHCgkKB/8BCAABBwgBCgcGBwoCAwv/CwIBCwEHCgYBBgcB/////wgJBggGBwkBBgsGAwEDBv8ACQELBgf/////////////BwgABwAGAwsACwYA/////wcLBv////////////////8HBgv/////////////////AwAICwcG/////////////wABCQsHBv////////////8IAQkIAwELBwb/////////CgECBgsH/////////////wECCgMACAYLB/////////8CCQACCgkGCwf/////////BgsHAgoDCggDCgkI/////wcCAwYCB/////////////8HAAgHBgAGAgD/////////AgcGAgMHAAEJ/////////wEGAgEIBgEJCAgHBv////8KBwYKAQcBAwf/////////CgcGAQcKAQgHAQAI/////wADBwAHCgAKCQYKB/////8HBgoHCggICgn/////////BggECwgG/////////////wMGCwMABgAEBv////////8IBgsIBAYJAAH/////////CQQGCQYDCQMBCwMG/////wYIBAYLCAIKAf////////8BAgoDAAsABgsABAb/////BAsIBAYLAAIJAgoJ/////woJAwoDAgkEAwsDBgQGA/8IAgMIBAIEBgL/////////AAQCBAYC/////////////wEJAAIDBAIEBgQDCP////8BCQQBBAICBAb/////////CAEDCAYBCAQGBgoB/////woBAAoABgYABP////////8EBgMEAwgGCgMAAwkKCQP/CgkEBgoE/////////////wQJBQcGC/////////////8ACAMECQULBwb/////////BQABBQQABwYL/////////wsHBggDBAMFBAMBBf////8JBQQKAQIHBgv/////////BgsHAQIKAAgDBAkF/////wcGCwUECgQCCgQAAv////8DBAgDBQQDAgUKBQILBwb/BwIDBwYCBQQJ/////////wkFBAAIBgAGAgYIB/////8DBgIDBwYBBQAFBAD/////BgIIBggHAgEIBAgFAQUI/wkFBAoBBgEHBgEDB/////8BBgoBBwYBAAcIBwAJBQT/BAAKBAoFAAMKBgoHAwcK/wcGCgcKCAUECgQICv////8GCQUGCwkLCAn/////////AwYLAAYDAAUGAAkF/////wALCAAFCwABBQUGC/////8GCwMGAwUFAwH/////////AQIKCQULCQsICwUG/////wALAwAGCwAJBgUGCQECCv8LCAULBQYIAAUKBQIAAgX/BgsDBgMFAgoDCgUD/////wUICQUCCAUGAgMIAv////8JBQYJBgAABgL/////////AQUIAQgABQYIAwgCBgII/wEFBgIBBv////////////8BAwYBBgoDCAYFBgkICQb/CgEACgAGCQUABQYA/////wADCAUGCv////////////8KBQb/////////////////CwUKBwUL/////////////wsFCgsHBQgDAP////////8FCwcFCgsBCQD/////////CgcFCgsHCQgBCAMB/////wsBAgsHAQcFAf////////8ACAMBAgcBBwUHAgv/////CQcFCQIHCQACAgsH/////wcFAgcCCwUJAgMCCAkIAv8CBQoCAwUDBwX/////////CAIACAUCCAcFCgIF/////wkAAQUKAwUDBwMKAv////8JCAIJAgEIBwIKAgUHBQL/AQMFAwcF/////////////wAIBwAHAQEHBf////////8JAAMJAwUFAwf/////////CQgHBQkH/////////////wUIBAUKCAoLCP////////8FAAQFCwAFCgsLAwD/////AAEJCAQKCAoLCgQF/////woLBAoEBQsDBAkEAQMBBP8CBQECCAUCCwgEBQj/////AAQLAAsDBAULAgsBBQEL/wACBQAFCQILBQQFCAsIBf8JBAUCCwP/////////////AgUKAwUCAwQFAwgE/////wUKAgUCBAQCAP////////8DCgIDBQoDCAUEBQgAAQn/BQoCBQIEAQkCCQQC/////wgEBQgFAwMFAf////////8ABAUBAAX/////////////CAQFCAUDCQAFAAMF/////wkEBf////////////////8ECwcECQsJCgv/////////AAgDBAkHCQsHCQoL/////wEKCwELBAEEAAcEC/////8DAQQDBAgBCgQHBAsKCwT/BAsHCQsECQILCQEC/////wkHBAkLBwkBCwILAQAIA/8LBwQLBAICBAD/////////CwcECwQCCAMEAwIE/////wIJCgIHCQIDBwcECf////8JCgcJBwQKAgcIBwACAAf/AwcKAwoCBwQKAQoABAAK/wEKAggHBP////////////8ECQEEAQcHAQP/////////BAkBBAEHAAgBCAcB/////wQAAwcEA/////////////8ECAf/////////////////CQoICgsI/////////////wMACQMJCwsJCv////////8AAQoACggICgv/////////AwEKCwMK/////////////wECCwELCQkLCP////////8DAAkDCQsBAgkCCwn/////AAILCAAL/////////////wMCC/////////////////8CAwgCCAoKCAn/////////CQoCAAkC/////////////wIDCAIICgABCAEKCP////8BCgL/////////////////AQMICQEI/////////////wAJAf////////////////8AAwj//////////////////////////////////////w==
"""
TRI_TABLE = np.frombuffer(base64.b64decode(_TRI_B64), dtype=np.int8).reshape(256, 16)

# Cube-corner offsets and the 12 edges, matching TRI_TABLE.
_CORNER = np.array(
    [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
    ],
    dtype=np.float64,
)
_EDGE = np.array(
    [
        (0, 1),
        (1, 2),
        (2, 3),
        (3, 0),
        (4, 5),
        (5, 6),
        (6, 7),
        (7, 4),
        (0, 4),
        (1, 5),
        (2, 6),
        (3, 7),
    ],
    dtype=np.int64,
)

MATERIALS = ("eyes", "skin", "towel", "belt", "buckle", "wraps", "pants", "boots", "base")
COLORS = {
    "eyes": np.array([0.83, 0.80, 0.72]),
    "skin": np.array([0.79, 0.52, 0.36]),
    "towel": np.array([0.89, 0.82, 0.66]),
    "belt": np.array([0.36, 0.24, 0.16]),
    "buckle": np.array([0.72, 0.70, 0.64]),
    "wraps": np.array([0.75, 0.66, 0.50]),
    "pants": np.array([0.32, 0.34, 0.22]),
    "boots": np.array([0.30, 0.20, 0.13]),
    "base": np.array([0.22, 0.20, 0.18]),
}


def smin(a, b, k):
    """Polynomial smooth union. k is the blend radius in millimeters."""
    if k <= 1e-5:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


def smin_all(parts, k):
    acc = parts[0]
    for part in parts[1:]:
        acc = smin(acc, part, k)
    return acc


def sd_sphere(x, y, z, c, r):
    return np.sqrt((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2) - r


def sd_ellipsoid(x, y, z, c, rad):
    """Outside distance is the Quilez approximation; inside is a true bound.

    The plain approximation returns 0 at the center, which would hollow
    every ellipsoid. Inside the unit ball we use a scaled radius instead.
    """
    rx, ry, rz = rad
    px = (x - c[0]) / rx
    py = (y - c[1]) / ry
    pz = (z - c[2]) / rz
    k0 = np.sqrt(px * px + py * py + pz * pz)
    k1 = np.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2)
    outside = k0 * (k0 - 1.0) / np.maximum(k1, 1e-8)
    inside = (k0 - 1.0) * min(rx, ry, rz)
    return np.where(k0 < 1.0, inside, outside)


def sd_capsule(x, y, z, a, b, r):
    ax, ay, az = a
    bx, by, bz = b
    bax, bay, baz = bx - ax, by - ay, bz - az
    pax, pay, paz = x - ax, y - ay, z - az
    baba = bax * bax + bay * bay + baz * baz
    h = np.clip((pax * bax + pay * bay + paz * baz) / baba, 0.0, 1.0)
    dx, dy, dz = pax - bax * h, pay - bay * h, paz - baz * h
    return np.sqrt(dx * dx + dy * dy + dz * dz) - r


def sd_round_box(x, y, z, c, half, rnd, yaw=0.0):
    px, py, pz = x - c[0], y - c[1], z - c[2]
    if yaw:
        a = np.deg2rad(yaw)
        co, si = np.cos(a), np.sin(a)
        px, py = co * px + si * py, -si * px + co * py
    rnd = min(float(rnd), float(min(half)) * 0.95)
    qx = np.abs(px) - (half[0] - rnd)
    qy = np.abs(py) - (half[1] - rnd)
    qz = np.abs(pz) - (half[2] - rnd)
    ax, ay, az = np.maximum(qx, 0.0), np.maximum(qy, 0.0), np.maximum(qz, 0.0)
    outside = np.sqrt(ax * ax + ay * ay + az * az)
    inside = np.minimum(np.maximum(qx, np.maximum(qy, qz)), 0.0)
    return outside + inside - rnd


def sd_capped_cyl(x, y, z, r, z0, z1):
    cz = (z0 + z1) * 0.5
    hh = (z1 - z0) * 0.5
    dx = np.sqrt(x * x + y * y) - r
    dz = np.abs(z - cz) - hh
    ax = np.maximum(dx, 0.0)
    az = np.maximum(dz, 0.0)
    return np.sqrt(ax * ax + az * az) + np.minimum(np.maximum(dx, dz), 0.0)


def sd_torus_axis(x, y, z, center, axis, ring_r, tube_r):
    ax, ay, az = axis
    norm = (ax * ax + ay * ay + az * az) ** 0.5
    ax, ay, az = ax / norm, ay / norm, az / norm
    dx, dy, dz = x - center[0], y - center[1], z - center[2]
    axial = dx * ax + dy * ay + dz * az
    radial = np.sqrt(np.maximum(dx * dx + dy * dy + dz * dz - axial * axial, 0.0))
    q = radial - ring_r
    return np.sqrt(q * q + axial * axial) - tube_r


def yaw_about(x, y, origin, deg):
    """Rotate sample points so geometry built in +Y faces `deg` (positive toward +X)."""
    a = np.deg2rad(deg)
    co, si = np.cos(a), np.sin(a)
    dx, dy = x - origin[0], y - origin[1]
    # Inverse rotation: the head feature yaws by +deg in the world.
    return origin[0] + co * dx + si * dy, origin[1] - si * dx + co * dy


def _unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


def head_fields(x, y, z):
    """Bald head, heavy brow, short beard, deep-set pale eyes. Yawed slightly toward his left."""
    cx, cy, cz = 0.0, 0.05, 29.30
    # Portrait gaze is off toward his left, which is -X.
    X, Y = yaw_about(x, y, (cx, cy), -11.0)
    Z = z
    hx, hy, hz = X - cx, Y - cy, Z - cz

    # Big forehead, narrower than the jaw-and-beard width so the head isn't an egg.
    cranium = sd_ellipsoid(hx, hy, hz, (0.0, -0.05, 0.55), (3.30, 3.55, 3.70))
    jaw = sd_ellipsoid(hx, hy, hz, (0.0, 0.40, -1.45), (2.85, 2.85, 1.85))
    head = smin(cranium, jaw, 0.65)

    # Features have to break the cranium surface (about y = 3.4). Buried
    # detail from the last pass rendered as a blank egg.
    brow_l = sd_capsule(hx, hy, hz, (-1.70, 3.15, 0.95), (-0.15, 3.55, 0.35), 0.42)
    brow_r = sd_capsule(hx, hy, hz, (1.70, 3.15, 0.95), (0.15, 3.55, 0.35), 0.42)
    head = smin(head, smin(brow_l, brow_r, 0.22), 0.26)
    lid_l = sd_capsule(hx, hy, hz, (-1.55, 3.25, 0.28), (-0.40, 3.55, 0.02), 0.24)
    lid_r = sd_capsule(hx, hy, hz, (1.55, 3.25, 0.28), (0.40, 3.55, 0.02), 0.24)
    head = smin(head, smin(lid_l, lid_r, 0.12), 0.14)

    bridge = sd_capsule(hx, hy, hz, (0.0, 3.15, 0.55), (0.0, 3.70, -0.05), 0.24)
    nose = sd_ellipsoid(hx, hy, hz, (0.0, 3.65, -0.22), (0.52, 0.62, 0.66))
    head = smin(head, bridge, 0.16)
    head = smin(head, nose, 0.14)

    ear_l = sd_ellipsoid(hx, hy, hz, (-3.35, -0.35, -0.25), (0.55, 0.70, 1.00))
    ear_r = sd_ellipsoid(hx, hy, hz, (3.35, -0.35, -0.25), (0.55, 0.70, 1.00))
    head = smin(head, smin(ear_l, ear_r, 0.2), 0.25)

    # Chin beard and mustache, sitting on the jaw rather than under it.
    beard = sd_ellipsoid(hx, hy, hz, (0.0, 2.55, -2.35), (2.15, 1.55, 1.05))
    jaw_l = sd_capsule(hx, hy, hz, (-2.15, 1.4, -0.85), (-0.55, 2.35, -2.15), 0.58)
    jaw_r = sd_capsule(hx, hy, hz, (2.15, 1.4, -0.85), (0.55, 2.35, -2.15), 0.58)
    mustache = sd_ellipsoid(hx, hy, hz, (0.0, 3.35, -0.95), (1.15, 0.50, 0.28))
    head = smin(head, beard, 0.28)
    head = smin(head, smin(jaw_l, jaw_r, 0.18), 0.22)
    head = smin(head, mustache, 0.14)

    socket_l = sd_sphere(hx, hy, hz, (-1.08, 2.95, -0.02), 0.72)
    socket_r = sd_sphere(hx, hy, hz, (1.08, 2.95, -0.02), 0.72)
    head = smax(head, -socket_l, 0.08)
    head = smax(head, -socket_r, 0.08)
    eye_l = sd_sphere(hx, hy, hz, (-1.08, 2.62, -0.04), 0.38)
    eye_r = sd_sphere(hx, hy, hz, (1.08, 2.62, -0.04), 0.38)
    eyes = smin(eye_l, eye_r, 0.1)

    mouth = sd_capsule(hx, hy, hz, (-0.72, 3.45, -1.25), (0.72, 3.45, -1.25), 0.11)
    mouth_l = sd_capsule(hx, hy, hz, (-0.50, 3.40, -1.22), (-1.05, 3.15, -1.42), 0.09)
    mouth_r = sd_capsule(hx, hy, hz, (0.50, 3.40, -1.22), (1.05, 3.15, -1.42), 0.09)
    lip = sd_ellipsoid(hx, hy, hz, (0.0, 3.25, -1.55), (0.72, 0.36, 0.24))
    head = smin(head, lip, 0.10)
    head = smax(head, -mouth, 0.04)
    head = smax(head, -mouth_l, 0.04)
    head = smax(head, -mouth_r, 0.04)
    furrow = sd_capsule(hx, hy, hz, (0.0, 3.45, 0.25), (0.0, 3.25, 0.95), 0.11)
    head = smax(head, -furrow, 0.04)

    skin = smin(head, eyes, 0.08)
    return skin, eyes


def arm_fields(x, y, z, side):
    """side +1 is Gary's right. Arms hang, elbows out, fists forward at the belt."""
    s = float(side)
    # Thick arms, fists beside the hips so the buckle stays visible.
    shoulder = np.array([s * 6.55, -0.05, 24.85])
    elbow = np.array([s * 8.55, 0.85, 19.15])
    wrist = np.array([s * 7.35, 2.35, 14.55])
    fist_c = np.array([s * 6.85, 3.05, 12.85])

    upper = sd_capsule(x, y, z, shoulder, elbow, 2.55)
    delt = sd_ellipsoid(x, y, z, (s * 6.9, 0.15, 25.15), (2.35, 2.05, 2.15))
    biceps = sd_ellipsoid(x, y, z, (s * 7.7, 0.95, 22.05), (1.75, 1.55, 2.15))
    elbow_knob = sd_sphere(x, y, z, elbow, 2.25)
    forearm = sd_capsule(x, y, z, elbow, wrist, 1.85)
    limb = smin(upper, delt, 0.6)
    limb = smin(limb, biceps, 0.5)
    limb = smin(limb, elbow_knob, 0.4)
    limb = smin(limb, forearm, 0.38)

    fist = sd_round_box(x, y, z, fist_c, (1.20, 0.95, 1.35), 0.55)
    thumb = sd_ellipsoid(x, y, z, (s * 5.75, 3.45, 13.35), (0.58, 0.46, 0.72))
    limb = smin(limb, fist, 0.35)
    limb = smin(limb, thumb, 0.2)

    # Wraps: a thicker sleeve from mid-forearm over the fist, plus cloth ridges.
    wrap_from = elbow * 0.45 + wrist * 0.55
    wrap_vol = sd_capsule(x, y, z, wrap_from, fist_c, 2.22)
    axis = _unit(fist_c - elbow)
    ridges = []
    for t, ring_r, tube in (
        (0.50, 2.00, 0.32),
        (0.66, 2.05, 0.30),
        (0.82, 2.08, 0.30),
        (0.98, 1.85, 0.28),
    ):
        center = elbow * (1.0 - t) + fist_c * t
        ridges.append(sd_torus_axis(x, y, z, center, axis, ring_r, tube))
    wraps = smin(wrap_vol, smin_all(ridges, 0.15), 0.2)
    return limb, wraps


def leg_fields(x, y, z, side):
    s = float(side)
    hip = np.array([s * 3.55, 0.15, 13.15])
    knee = np.array([s * 3.65, 0.85, 8.05])
    ankle = np.array([s * 3.30, 0.20, 4.45])
    thigh = sd_capsule(x, y, z, hip, knee, 2.75)
    knee_cap = sd_sphere(x, y, z, (s * 3.55, 1.85, 8.15), 1.25)
    calf = sd_capsule(x, y, z, knee, ankle, 1.95)
    leg = smin(thigh, knee_cap, 0.35)
    leg = smin(leg, calf, 0.40)
    # Pant cuff bloused over the boot.
    cuff = sd_torus_axis(x, y, z, (s * 3.25, 0.35, 4.85), np.array([0.0, 0.0, 1.0]), 2.05, 0.32)
    leg = smin(leg, cuff, 0.2)
    return leg


def boot_field(x, y, z, side):
    """Work boots, toes turned out a little. Built in a local frame at the ankle."""
    s = float(side)
    ang = -s * np.deg2rad(11.0)
    co, si = np.cos(ang), np.sin(ang)
    ox, oy = s * 3.30, 0.10
    dx, dy = x - ox, y - oy
    lx = co * dx + si * dy
    ly = -si * dx + co * dy
    sole = sd_round_box(lx, ly, z, (0.0, 1.55, 1.28), (1.62, 3.45, 0.46), 0.30)
    upper = sd_round_box(lx, ly, z, (0.0, 1.35, 2.35), (1.42, 3.05, 0.85), 0.38)
    heel = sd_round_box(lx, ly, z, (0.0, -1.25, 1.55), (1.35, 1.15, 0.62), 0.22)
    shaft = sd_capsule(lx, ly, z, (0.0, 0.15, 2.5), (0.0, 0.05, 4.7), 1.78)
    toe = sd_ellipsoid(lx, ly, z, (0.0, 4.15, 1.85), (1.35, 1.15, 0.82))
    boot = smin(smin(sole, upper, 0.25), heel, 0.25)
    boot = smin(boot, shaft, 0.35)
    boot = smin(boot, toe, 0.3)
    return boot


def torso_field(x, y, z):
    rib = sd_ellipsoid(x, y, z, (0.0, 0.15, 21.70), (7.05, 4.35, 3.55))
    pec_r = sd_ellipsoid(x, y, z, (2.25, 2.85, 22.55), (2.35, 1.70, 1.55))
    pec_l = sd_ellipsoid(x, y, z, (-2.25, 2.85, 22.55), (2.35, 1.70, 1.55))
    # Soft gut, pushed forward so it hangs over the belt.
    gut = sd_ellipsoid(x, y, z, (0.0, 2.25, 17.55), (6.15, 5.35, 3.15))
    # Round waist the belt can cinch. Without this the belt floated in a gap.
    waist = sd_ellipsoid(x, y, z, (BELT_C[0], BELT_C[1], BELT_C[2]), (6.15, 5.45, 2.05))
    love_r = sd_ellipsoid(x, y, z, (4.6, 1.15, 17.35), (2.05, 2.35, 1.75))
    love_l = sd_ellipsoid(x, y, z, (-4.6, 1.15, 17.35), (2.05, 2.35, 1.75))
    lat_r = sd_ellipsoid(x, y, z, (5.15, -1.05, 22.45), (2.65, 2.45, 3.05))
    lat_l = sd_ellipsoid(x, y, z, (-5.15, -1.05, 22.45), (2.65, 2.45, 3.05))
    body = smin(rib, smin(pec_r, pec_l, 0.3), 0.65)
    body = smin(body, gut, 0.75)
    body = smin(body, waist, 0.45)
    body = smin(body, smin(love_r, love_l, 0.3), 0.5)
    body = smin(body, smin(lat_r, lat_l, 0.3), 0.6)
    navel = sd_sphere(x, y, z, (0.0, 6.6, 17.7), 0.28)
    body = smax(body, -navel, 0.06)
    return body


def neck_field(x, y, z):
    neck = sd_capsule(x, y, z, (0.0, 0.05, 23.7), (0.0, 0.20, 27.15), 2.05)
    trap_r = sd_ellipsoid(x, y, z, (3.15, -0.25, 25.35), (2.70, 2.15, 1.65))
    trap_l = sd_ellipsoid(x, y, z, (-3.15, -0.25, 25.35), (2.70, 2.15, 1.65))
    return smin(neck, smin(trap_r, trap_l, 0.3), 0.6)


def hips_field(x, y, z):
    pelvis = sd_ellipsoid(x, y, z, (0.0, 0.15, 13.55), (5.95, 4.25, 2.45))
    glute_r = sd_ellipsoid(x, y, z, (2.15, -1.75, 13.15), (2.45, 2.20, 2.05))
    glute_l = sd_ellipsoid(x, y, z, (-2.15, -1.75, 13.15), (2.45, 2.20, 2.05))
    return smin(pelvis, smin(glute_r, glute_l, 0.3), 0.55)


def belt_fields(x, y, z):
    axis = np.array([0.0, 0.0, 1.0])
    ring = sd_torus_axis(x, y, z, BELT_C, axis, BELT_R, BELT_T)
    groove = sd_torus_axis(x, y, z, BELT_C, axis, BELT_R + BELT_T - 0.08, 0.14)
    belt = smax(ring, -groove, 0.04)
    # Channel carved into the waist so the leather reads as cinched, not hovering.
    channel = sd_torus_axis(x, y, z, BELT_C, axis, BELT_R, 0.55)
    front = BELT_C[1] + BELT_R
    plate = sd_round_box(x, y, z, (0.0, front + 0.35, BELT_C[2]), (1.65, 0.48, 1.22), 0.16)
    recess = sd_round_box(x, y, z, (0.0, front + 0.62, BELT_C[2]), (1.00, 0.32, 0.68), 0.08)
    prong = sd_round_box(x, y, z, (0.0, front + 0.55, BELT_C[2]), (0.14, 0.30, 0.78), 0.05)
    bar = sd_round_box(x, y, z, (0.0, front + 0.05, BELT_C[2]), (1.25, 0.16, 0.14), 0.05)
    buckle = smax(plate, -recess, 0.05)
    buckle = smin(buckle, prong, 0.06)
    buckle = smin(buckle, bar, 0.06)
    return belt, buckle, channel


def towel_field(x, y, z):
    """The towel: cloth over both shoulders, pulled into a knot, two short tails.

    Flat ribbons read as armor plates at this size, so the knot and the
    hanging ends are round bundles of cloth.
    """
    knot = np.array([0.20, 5.55, 20.35])
    # Soft mass over each shoulder, drooping toward the chest and the back.
    mantle_r = sd_ellipsoid(x, y, z, (5.2, 0.55, 25.55), (2.6, 2.15, 0.85))
    mantle_l = sd_ellipsoid(x, y, z, (-5.2, 0.55, 25.55), (2.6, 2.15, 0.85))
    collar = sd_capsule(x, y, z, (-3.4, -1.35, 26.7), (3.4, -1.35, 26.7), 0.7)
    # Two rolls from each shoulder into the knot, like a towel gathered in the fist.
    roll_r = sd_capsule(x, y, z, (4.6, 2.15, 25.2), knot, 0.78)
    roll_l = sd_capsule(x, y, z, (-4.7, 2.25, 25.3), knot + np.array([-0.1, 0.05, 0.1]), 0.78)
    roll_r2 = sd_capsule(x, y, z, (3.3, 1.4, 25.6), knot + np.array([0.3, 0.1, 0.35]), 0.62)
    roll_l2 = sd_capsule(x, y, z, (-3.2, 1.5, 25.7), knot + np.array([-0.25, 0.1, 0.25]), 0.62)
    ball = sd_sphere(x, y, z, knot, 1.28)
    ball2 = sd_sphere(x, y, z, knot + np.array([0.15, 0.35, -0.15]), 0.85)
    loop = sd_torus_axis(
        x, y, z, knot + np.array([0.0, 0.45, 0.05]), np.array([0.1, 0.95, 0.05]), 0.62, 0.40
    )
    tail_a = sd_capsule(x, y, z, knot + np.array([0.2, 0.15, -0.9]), (1.25, 5.85, 16.15), 0.58)
    tail_b = sd_capsule(x, y, z, knot + np.array([-0.25, 0.1, -0.75]), (-0.95, 5.7, 16.85), 0.50)
    fray = smin_all(
        [
            sd_sphere(x, y, z, (1.55, 5.75, 15.85), 0.36),
            sd_sphere(x, y, z, (0.85, 5.9, 15.75), 0.32),
            sd_sphere(x, y, z, (-1.2, 5.6, 16.55), 0.34),
        ],
        0.12,
    )
    return smin_all(
        [mantle_r, mantle_l, collar, roll_r, roll_l, roll_r2, roll_l2, ball, ball2, loop, tail_a, tail_b, fray],
        0.34,
    )


def base_field(x, y, z):
    lower = sd_capped_cyl(x, y, z, BASE_RADIUS, 0.0, 1.70)
    chamfer = 0.55
    radial = np.sqrt(x * x + y * y)
    bevel = (radial - (BASE_RADIUS - chamfer) + (chamfer - z)) * np.sqrt(0.5)
    lower = np.maximum(lower, bevel)
    upper = sd_capped_cyl(x, y, z, BASE_RADIUS - 1.15, 1.20, 2.32)
    return smin(lower, upper, 0.32)


def fields(x, y, z):
    skin_head, eyes = head_fields(x, y, z)
    neck = neck_field(x, y, z)
    torso = torso_field(x, y, z)
    arm_r, wrap_r = arm_fields(x, y, z, +1)
    arm_l, wrap_l = arm_fields(x, y, z, -1)
    skin = smin(skin_head, neck, 0.55)
    skin = smin(skin, torso, 0.85)
    skin = smin(skin, smin(arm_r, arm_l, 0.3), 0.7)

    hips = hips_field(x, y, z)
    leg_r = leg_fields(x, y, z, +1)
    leg_l = leg_fields(x, y, z, -1)
    pants = smin(hips, smin(leg_r, leg_l, 0.35), 0.5)

    boots = smin(boot_field(x, y, z, +1), boot_field(x, y, z, -1), 0.2)
    wraps = smin(wrap_r, wrap_l, 0.2)
    towel = towel_field(x, y, z)
    belt, buckle, channel = belt_fields(x, y, z)
    base = base_field(x, y, z)
    return {
        "eyes": eyes,
        "skin": skin,
        "towel": towel,
        "belt": belt,
        "buckle": buckle,
        "channel": channel,
        "wraps": wraps,
        "pants": pants,
        "boots": boots,
        "base": base,
    }


def scene_sdf(x, y, z):
    f = fields(x, y, z)
    d = smin(f["skin"], f["eyes"], 0.08)
    d = smin(d, f["pants"], 0.50)
    d = smax(d, -f["channel"], 0.10)
    d = smin(d, f["boots"], 0.38)
    d = smin(d, f["wraps"], 0.30)
    d = smin(d, f["towel"], 0.40)
    d = smin(d, f["belt"], 0.24)
    d = smin(d, f["buckle"], 0.16)
    d = smin(d, f["base"], 0.40)
    return d


def write_png(path, rgb):
    rgb = np.ascontiguousarray(rgb, dtype=np.uint8)
    height, width, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[i].tobytes() for i in range(height))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 6))
    png += chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def render_view(name, eye, target, width, height, half_height, up_hint=(0.0, 0.0, 1.0)):
    t0 = time.time()
    eye = np.asarray(eye, dtype=np.float64)
    target = np.asarray(target, dtype=np.float64)
    forward = target - eye
    forward = forward / np.linalg.norm(forward)
    right = np.cross(forward, np.asarray(up_hint, dtype=np.float64))
    if np.linalg.norm(right) < 1e-6:
        right = np.array([0.0, 1.0, 0.0])
    right = right / np.linalg.norm(right)
    up = np.cross(right, forward)
    up = up / np.linalg.norm(up)

    aspect = width / height
    half_w = half_height * aspect
    xs = np.linspace(-half_w, half_w, width, dtype=np.float64)
    ys = np.linspace(half_height, -half_height, height, dtype=np.float64)
    uu, vv = np.meshgrid(xs, ys)
    origins = eye + uu[..., None] * right + vv[..., None] * up
    direction = np.broadcast_to(forward, origins.shape).copy()

    t = np.zeros((height, width), dtype=np.float64)
    hit = np.zeros((height, width), dtype=bool)
    max_t = 90.0
    for _ in range(72):
        if hit.all():
            break
        pos = origins + t[..., None] * direction
        dist = scene_sdf(pos[..., 0], pos[..., 1], pos[..., 2])
        close = dist < 0.10
        hit = hit | close
        step = np.maximum(dist, 0.04) * 0.72
        t = np.where(hit, t, t + step)
        hit = hit | (t >= max_t)
    escaped = t >= max_t - 1e-3
    hit = hit & ~escaped

    pos = origins + t[..., None] * direction
    eps = 0.12
    gx = scene_sdf(pos[..., 0] + eps, pos[..., 1], pos[..., 2]) - scene_sdf(pos[..., 0] - eps, pos[..., 1], pos[..., 2])
    gy = scene_sdf(pos[..., 0], pos[..., 1] + eps, pos[..., 2]) - scene_sdf(pos[..., 0], pos[..., 1] - eps, pos[..., 2])
    gz = scene_sdf(pos[..., 0], pos[..., 1], pos[..., 2] + eps) - scene_sdf(pos[..., 0], pos[..., 1], pos[..., 2] - eps)
    normal = np.stack([gx, gy, gz], axis=-1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-8)

    part = fields(pos[..., 0], pos[..., 1], pos[..., 2])
    stacked = np.stack([part[name] for name in MATERIALS], axis=0)
    mat_i = np.argmin(stacked, axis=0)
    # Eyeballs are buried in the socket. Prefer them when the eye surface is the one we hit.
    eye_here = part["eyes"] < 0.18
    mat_i = np.where(eye_here & (part["eyes"] <= stacked.min(axis=0) + 0.08), 0, mat_i)

    key = _unit([-0.55, 0.42, 0.72])
    fill = _unit([0.15, 0.92, 0.28])
    rim = _unit([0.65, -0.55, 0.45])
    ndk = np.clip((normal * key).sum(-1), 0.0, 1.0)
    ndf = np.clip((normal * fill).sum(-1), 0.0, 1.0)
    ndr = np.clip((normal * rim).sum(-1), 0.0, 1.0)
    # A short step along the normal darkens creases (brow, belt, towel knot).
    occl = scene_sdf(pos[..., 0] + normal[..., 0] * 0.8, pos[..., 1] + normal[..., 1] * 0.8, pos[..., 2] + normal[..., 2] * 0.8)
    ao = np.clip(occl / 0.8, 0.0, 1.0)

    palette = np.stack([COLORS[name] for name in MATERIALS], axis=0)
    base_col = palette[mat_i]
    light = (0.20 + 0.78 * ndk + 0.18 * ndf) * (0.45 + 0.55 * ao)
    color = base_col * light[..., None]
    color += (ndr**2)[..., None] * np.array([0.28, 0.22, 0.16])
    metal = MATERIALS[mat_i] if False else mat_i == MATERIALS.index("buckle")
    spec = np.clip((normal * _unit([-0.2, 0.7, 0.6])).sum(-1), 0.0, 1.0) ** 12
    color = np.where(metal[..., None], color + spec[..., None] * 0.45, color)

    v = np.linspace(0, 1, height, dtype=np.float64)[:, None]
    bg = (1 - v[..., None]) * np.array([0.10, 0.08, 0.07]) + v[..., None] * np.array([0.24, 0.19, 0.16])
    # 10 mm scale bar, lower left.
    px_per_mm = height / (2 * half_height)
    bar = int(round(10 * px_per_mm))
    image = np.where(hit[..., None], np.clip(color, 0, 1), bg)
    image = (image * 255).astype(np.uint8)
    image[-28:-18, 16 : 16 + bar] = 235
    image[-28:-18, 16 : 20] = 235
    image[-28:-18, 12 + bar : 16 + bar] = 235
    path = HERE / f"preview-{name}.png"
    write_png(path, image)
    print(f"  {name:8}  {width}x{height}  {time.time() - t0:.1f}s  -> {path.name}", flush=True)
    return path


def preview():
    print("raymarching views…", flush=True)
    render_view("threeq", (-26, 32, 24), (0, 0.4, 16), 400, 580, 21)
    render_view("front", (0, 46, 17), (0, 0, 16), 360, 520, 21)
    render_view("side", (-46, 2, 17), (0, 0, 16), 360, 520, 21)
    render_view("face", (-8, 18, 31.2), (0.1, 0.3, 28.6), 420, 420, 6.4)
    render_view("name", (0.5, 24, 12), (0.2, 8.6, 2.6), 520, 260, 4.2)
    render_view("top", (0.0, 0.0, 54), (0, 0, 14), 420, 420, 16, up_hint=(0.0, -1.0, 0.0))
    probes = {
        "head center": (0.0, 0.2, 29.3),
        "nose tip": (0.0, 6.2, 28.6),
        "between knees": (0.0, 0.6, 8.0),
        "right fist": (7.45, 4.15, 13.85),
        "above crown": (0.0, 0.0, 36.0),
    }
    print("sdf probes (negative is inside):")
    for label, p in probes.items():
        d = float(scene_sdf(np.array(p[0]), np.array(p[1]), np.array(p[2])))
        print(f"  {label:16} {d:+.2f}")


def marching_cubes(volume, origin, voxel):
    inside = volume < 0.0
    idx = (
        inside[:-1, :-1, :-1].astype(np.uint16)
        | (inside[1:, :-1, :-1].astype(np.uint16) << 1)
        | (inside[1:, 1:, :-1].astype(np.uint16) << 2)
        | (inside[:-1, 1:, :-1].astype(np.uint16) << 3)
        | (inside[:-1, :-1, 1:].astype(np.uint16) << 4)
        | (inside[1:, :-1, 1:].astype(np.uint16) << 5)
        | (inside[1:, 1:, 1:].astype(np.uint16) << 6)
        | (inside[:-1, 1:, 1:].astype(np.uint16) << 7)
    )
    active = np.argwhere((idx > 0) & (idx < 255))
    if len(active) == 0:
        raise RuntimeError("sculpt is empty — the grid missed the figure")
    cases = idx[active[:, 0], active[:, 1], active[:, 2]]
    corner_vals = np.stack(
        [volume[active[:, 0] + ox, active[:, 1] + oy, active[:, 2] + oz] for ox, oy, oz in _CORNER.astype(int)],
        axis=1,
    )
    edge_pos = np.empty((len(active), 12, 3), dtype=np.float64)
    base = active.astype(np.float64)
    for e, (a, b) in enumerate(_EDGE):
        va = corner_vals[:, a]
        vb = corner_vals[:, b]
        denom = va - vb
        t = np.where(np.abs(denom) < 1e-12, 0.5, va / denom)
        t = np.clip(t, 0.0, 1.0)
        edge_pos[:, e, :] = base + _CORNER[a] + t[:, None] * (_CORNER[b] - _CORNER[a])

    tris = []
    for case in range(1, 255):
        sel = cases == case
        if not np.any(sel):
            continue
        row = TRI_TABLE[case]
        used = edge_pos[sel]
        for k in range(0, 16, 3):
            if row[k] < 0:
                break
            tris.append(used[:, (int(row[k]), int(row[k + 1]), int(row[k + 2])), :])
    mesh = np.concatenate(tris, axis=0)
    mesh = origin + mesh * voxel
    # Drop slivers.
    area = np.linalg.norm(np.cross(mesh[:, 1] - mesh[:, 0], mesh[:, 2] - mesh[:, 0]), axis=1)
    mesh = mesh[area > 1e-8]
    return mesh


def signed_volume(tris):
    return float(np.sum(np.einsum("ij,ij->i", tris[:, 0], np.cross(tris[:, 1], tris[:, 2]))) / 6.0)


def manifold_counts(tris, tol=1e-3):
    q = np.round(tris / tol).astype(np.int64)
    edges = np.concatenate([q[:, [0, 1]], q[:, [1, 2]], q[:, [2, 0]]], axis=0)
    edges = np.sort(edges, axis=1).reshape(-1, 6)
    order = np.lexsort(edges.T)
    edges = edges[order]
    if len(edges) == 0:
        return 0, 0
    change = np.any(edges[1:] != edges[:-1], axis=1)
    starts = np.concatenate([[0], np.flatnonzero(change) + 1, [len(edges)]])
    lengths = np.diff(starts)
    boundary = int(np.sum(lengths == 1))
    nonmanifold = int(np.sum(lengths > 2))
    return boundary, nonmanifold


def write_stl(path, tris, label):
    count = len(tris)
    normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    header = label.encode("ascii", "replace")[:80].ljust(80, b"\0")
    dtype = np.dtype(
        [
            ("n", "<f4", (3,)),
            ("v", "<f4", (3, 3)),
            ("attr", "<u2"),
        ]
    )
    rec = np.zeros(count, dtype=dtype)
    rec["n"] = normals.astype(np.float32)
    rec["v"] = tris.astype(np.float32)
    with open(path, "wb") as fh:
        fh.write(header)
        fh.write(struct.pack("<I", count))
        fh.write(rec.tobytes())


def sample_volume(voxel):
    pad = 1.2
    xs = np.arange(-BASE_RADIUS - pad, BASE_RADIUS + pad + voxel, voxel)
    ys = np.arange(-BASE_RADIUS - pad, BASE_RADIUS + pad + voxel, voxel)
    zs = np.arange(-0.8, CROWN_Z + 1.4 + voxel, voxel)
    volume = np.empty((len(xs), len(ys), len(zs)), dtype=np.float32)
    print(f"sampling {volume.shape} at {voxel:.2f} mm …", flush=True)
    t0 = time.time()
    slab = 4
    xx = xs.reshape(-1, 1, 1)
    yy = ys.reshape(1, -1, 1)
    for k0 in range(0, len(zs), slab):
        k1 = min(len(zs), k0 + slab)
        zz = zs[k0:k1].reshape(1, 1, -1)
        volume[:, :, k0:k1] = scene_sdf(xx, yy, zz).astype(np.float32)
        print(f"  z {k1}/{len(zs)}", flush=True)
    print(f"  sampled in {time.time() - t0:.1f}s", flush=True)
    boundary = min(
        float(volume[0].min()),
        float(volume[-1].min()),
        float(volume[:, 0].min()),
        float(volume[:, -1].min()),
        float(volume[:, :, 0].min()),
        float(volume[:, :, -1].min()),
    )
    if boundary < 0:
        raise RuntimeError(f"figure crosses the sample box (boundary sdf {boundary:.2f})")
    return volume, np.array([xs[0], ys[0], zs[0]], dtype=np.float64), voxel


def mesh(voxel=0.16):
    volume, origin, voxel = sample_volume(voxel)
    print("marching cubes…", flush=True)
    tris = marching_cubes(volume, origin, voxel)
    vol = signed_volume(tris)
    if vol < 0:
        tris = tris[:, [0, 2, 1], :]
        vol = -vol
    boundary, nonmanifold = manifold_counts(tris)
    lo = tris.reshape(-1, 3).min(axis=0)
    hi = tris.reshape(-1, 3).max(axis=0)
    print(f"  triangles {len(tris)}")
    print(f"  volume {vol:.1f} cm^3-scale mm^3 = {vol:.0f} mm^3")
    print(f"  bounds x[{lo[0]:.1f},{hi[0]:.1f}] y[{lo[1]:.1f},{hi[1]:.1f}] z[{lo[2]:.1f},{hi[2]:.1f}]")
    print(f"  open edges {boundary}, nonmanifold edges {nonmanifold}")

    game = HERE / "gary-grapplesauce-stylized-32mm.stl"
    write_stl(game, tris, "Gary Grapplesauce stylized 32mm medium base 25mm")
    crown = float(hi[2])
    display_scale = 54.0 / crown
    display = tris * display_scale
    show = HERE / "gary-grapplesauce-stylized-54mm.stl"
    write_stl(show, display, "Gary Grapplesauce stylized 54mm display")
    print(f"  wrote {game.name} ({game.stat().st_size / 1e6:.1f} MB)")
    print(f"  wrote {show.name} ({show.stat().st_size / 1e6:.1f} MB), scale {display_scale:.3f}")
    return boundary, nonmanifold, vol


def self_test():
    """A sphere must come back closed, outward-facing, and the right size."""
    voxel = 0.35
    r = 5.0
    xs = np.arange(-6.5, 6.5, voxel)
    ys = np.arange(-6.5, 6.5, voxel)
    zs = np.arange(-6.5, 6.5, voxel)
    xx, yy, zz = np.meshgrid(xs, ys, zs, indexing="ij")
    volume = (np.sqrt(xx**2 + yy**2 + zz**2) - r).astype(np.float32)
    tris = marching_cubes(volume, np.array([xs[0], ys[0], zs[0]]), voxel)
    vol = signed_volume(tris)
    if vol < 0:
        tris = tris[:, [0, 2, 1], :]
        vol = -vol
    boundary, nonmanifold = manifold_counts(tris)
    expect = 4.0 / 3.0 * np.pi * r**3
    print(f"sphere volume {vol:.1f} vs {expect:.1f}, open {boundary}, nonmanifold {nonmanifold}")
    if boundary or nonmanifold or abs(vol - expect) / expect > 0.08:
        raise SystemExit("marching cubes failed the sphere test")


def main(argv):
    command = argv[1] if len(argv) > 1 else "preview"
    if command == "self-test":
        self_test()
    elif command == "preview":
        preview()
    elif command == "mesh":
        self_test()
        voxel = float(argv[2]) if len(argv) > 2 else 0.16
        mesh(voxel)
    else:
        raise SystemExit(f"unknown command {command!r}; use preview, mesh, or self-test")


if __name__ == "__main__":
    main(sys.argv)
