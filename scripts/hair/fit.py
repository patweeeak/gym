"""Fit the MakeHuman basemesh head onto the Innerscene GLB head (similarity ICP) and print the transform."""
import json, struct, sys
import numpy as np
from scipy.spatial import cKDTree

glb, objp, out = sys.argv[1], sys.argv[2], sys.argv[3]
b = open(glb, 'rb').read()
clen, _ = struct.unpack('<II', b[12:20])
j = json.loads(b[20:20 + clen])
bin_off = 20 + clen + 8
def acc(i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
    off = bin_off + v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(b, dt, a['count'] * n, off).reshape(a['count'], n).astype(np.float64)
pr = j['meshes'][0]['primitives'][0]
P = acc(pr['attributes']['POSITION']); N = acc(pr['attributes']['NORMAL'])
J = acc(pr['attributes']['JOINTS_0']).astype(int); W = acc(pr['attributes']['WEIGHTS_0'])
joints = [j['nodes'][k].get('name') for k in j['skins'][0]['joints']]
hi = joints.index('head')
headW = ((J == hi) * W).sum(1)
G = P[headW > 0.95]
GN = N[headW > 0.95]
print('glb head verts', len(G), 'centroid', G.mean(0), 'z range', G[:, 2].min(), G[:, 2].max())

V = np.array([[float(x) for x in l.split()[1:4]] for l in open(objp) if l.startswith('v ')])[:13380]
# rough head of basemesh: same relative region (above the jaw/neck)
top = V[:, 1].max()
Bh = V[(V[:, 1] > top - 2.45) & (np.abs(V[:, 0]) < 1.3)]
print('base head verts', len(Bh), 'centroid', Bh.mean(0))

# init similarity: match centroids and spread
s = np.sqrt(((G - G.mean(0)) ** 2).sum(1).mean() / ((Bh - Bh.mean(0)) ** 2).sum(1).mean())
R = np.eye(3); t = G.mean(0) - s * Bh.mean(0)
tree = cKDTree(G)
for it in range(60):
    X = (s * Bh @ R.T) + t
    d, idx = tree.query(X)
    keep = d < np.percentile(d, 90)
    A, Bm = Bh[keep], G[idx[keep]]
    ma, mb = A.mean(0), Bm.mean(0)
    A0, B0 = A - ma, Bm - mb
    U, S, Vt = np.linalg.svd(B0.T @ A0)
    D = np.diag([1, 1, np.sign(np.linalg.det(U @ Vt))])
    R = U @ D @ Vt
    s = (S * np.diag(D)).sum() / (A0 ** 2).sum()
    t = mb - s * (R @ ma)
X = (s * Bh @ R.T) + t
d, _ = tree.query(X)
print('scale', s, 'rot\n', R, '\nt', t, '\nresid mm mean %.2f p90 %.2f max %.2f' % (d.mean() * 1000, np.percentile(d, 90) * 1000, d.max() * 1000))
# upper body (no arms) - long hair must also stay clear of the neck, shoulders and back
armW = sum(((J == joints.index(nm)) * W).sum(1) for nm in joints if nm.startswith(('upperarm', 'lowerarm', 'hand')))
body = (P[:, 1] > 0.9) & (armW < 0.3) & (headW <= 0.95)
np.savez(out, s=s, R=R, t=t, G=G, GN=GN, B=P[body], BN=N[body])
