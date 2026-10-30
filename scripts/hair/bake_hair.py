"""Bake MakeHuman hair proxies into the Innerscene GLB's mesh space.

Output per style: <out>/<id>.bin  (uint32 json length, json header, float32 positions, uint16 uvs, uint32/16 indices)
                  <out>/<id>.webp (strand texture with alpha, 1024 px)
"""
import json, struct, sys, os
import numpy as np
from scipy.spatial import cKDTree
from scipy import ndimage
from PIL import Image

fitp, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
F = np.load(fitp)
s, R, t = F['s'], F['R'], F['t']
# skin to keep clear of: head (tight) and the rest of the upper body (looser - it breathes and bends)
G = np.concatenate([F['G'], F['B']]); GN = np.concatenate([F['GN'], F['BN']])
GN /= np.linalg.norm(GN, axis=1, keepdims=True)
CLR = np.concatenate([np.full(len(F['G']), 0.0025), np.full(len(F['B']), 0.008)])
tree = cKDTree(G)
os.makedirs(out, exist_ok=True)

STYLES = {  # our id -> MakeHuman folder
    'crop': 'short02', 'sidepart': 'short04', 'ponytail': 'ponytail01', 'bob': 'bob01',
    'long': 'long01', 'braid': 'braid01', 'afro': 'afro01',
}

def load_obj(p):
    V, T, faces = [], [], []
    for l in open(p):
        if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('vt '): T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith('f '):
            faces.append([tuple(int(k) - 1 if k else -1 for k in (c.split('/') + ['', ''])[:2]) for c in l.split()[1:]])
    return np.array(V), np.array(T), faces

BASE = np.array([[float(x) for x in l.split()[1:4]] for l in open(sys.argv[4]) if l.startswith('v ')])

def fitted(mhclo):
    """MakeHuman proxy fitting: each vertex = barycentric point on a basemesh triangle + scaled offset."""
    scale, rows, inverts = np.ones(3), [], False
    for l in open(mhclo):
        w = l.split()
        if not w or w[0].startswith('#'): continue
        if w[0] in ('x_scale', 'y_scale', 'z_scale'):
            ax = 'xyz'.index(w[0][0]); a, b, r = int(w[1]), int(w[2]), float(w[3])
            scale[ax] = abs(BASE[a, ax] - BASE[b, ax]) / r
        elif w[0] == 'verts': inverts = True
        elif inverts:
            try: nums = [float(x) for x in w]
            except ValueError:
                if rows: inverts = False  # a keyword after the vertex block ends it
                continue
            if len(nums) in (1, 9): rows.append(nums)
    out = []
    for r in rows:
        if len(r) == 1: out.append(BASE[int(r[0])])
        else:
            i0, i1, i2 = int(r[0]), int(r[1]), int(r[2])
            out.append(r[3] * BASE[i0] + r[4] * BASE[i1] + r[5] * BASE[i2] + np.array(r[6:9]) * scale)
    return np.array(out)

for sid, folder in STYLES.items():
    d = os.path.join(src, folder)
    V, T, faces = load_obj(os.path.join(d, folder + '.obj'))
    Vf = fitted(os.path.join(d, folder + '.mhclo'))
    assert len(Vf) == len(V), (sid, len(Vf), len(V))
    V = Vf
    X = (s * V @ R.T) + t
    # push anything that sinks into (or hugs) the skin back out along the skin normal
    dist, idx = tree.query(X)
    for _ in range(5):
        q, n, clr = G[idx], GN[idx], CLR[idx]
        h = ((X - q) * n).sum(1)
        fix = (dist < 0.04) & (h < clr)
        X[fix] += (clr[fix] - h[fix])[:, None] * n[fix]
        dist, idx = tree.query(X)
    # unique (v, vt) corners
    key, verts, idxs = {}, [], []
    for f in faces:
        ids = []
        for c in f:
            if c not in key: key[c] = len(verts); verts.append(c)
            ids.append(key[c])
        for k in range(1, len(ids) - 1): idxs += [ids[0], ids[k], ids[k + 1]]
    vi = np.array([c[0] for c in verts]); ti = np.array([c[1] for c in verts])
    pos = X[vi].astype(np.float32)
    uv = T[ti] if len(T) else np.zeros((len(vi), 2))
    uv16 = np.clip(np.round(uv * 65535), 0, 65535).astype(np.uint16)
    big = len(verts) > 65535
    ind = np.array(idxs, dtype=np.uint32 if big else np.uint16)
    tex = [x for x in os.listdir(d) if x.endswith('_diffuse.png')][0]
    im = Image.open(os.path.join(d, tex)).convert('RGBA')
    im.thumbnail((1024, 1024), Image.LANCZOS)
    # colour bleed: transparent texels take the colour of the nearest strand, so soft edges never
    # blend towards the white background
    arr = np.asarray(im).copy()
    _, (iy, ix) = ndimage.distance_transform_edt(arr[..., 3] < 128, return_indices=True)
    arr[..., :3] = arr[iy, ix, :3]
    im = Image.fromarray(arr, 'RGBA')
    a = np.asarray(im).astype(np.float64) / 255
    lin = np.where(a[..., :3] <= 0.04045, a[..., :3] / 12.92, ((a[..., :3] + 0.055) / 1.055) ** 2.4)
    L = lin @ np.array([0.2126, 0.7152, 0.0722])
    lumMean = float(L[a[..., 3] > 0.5].mean())
    hdr = json.dumps({'v': len(verts), 'i': len(ind), 'big': big, 'lum': round(lumMean, 5)}).encode()
    hdr += b' ' * ((4 - (len(hdr) + 4) % 4) % 4)
    with open(os.path.join(out, sid + '.bin'), 'wb') as fo:
        fo.write(struct.pack('<I', len(hdr))); fo.write(hdr)
        fo.write(pos.tobytes()); fo.write(uv16.tobytes()); fo.write(ind.tobytes())
    im.save(os.path.join(out, sid + '.webp'), 'WEBP', quality=82, method=4)
    pushed = (np.abs(X - ((s * V @ R.T) + t)).sum(1) > 1e-6).mean()
    print(sid, 'lum %.4f' % lumMean, 'verts', len(verts), 'tris', len(ind) // 3, 'tex', im.size, 'pushed %.0f%%' % (pushed * 100),
          'bbox', pos.min(0).round(3), pos.max(0).round(3))
