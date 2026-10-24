#!/usr/bin/env python3
"""Builds the typewriter sound pack in static/sounds/typewriter from CC0 Freesound recordings.

Usage:
  python3 -I scripts/build_sounds.py <download-dir>            # download (if missing) + build
  python3 -I scripts/build_sounds.py <download-dir> --analyze  # print detected hits per file

Needs ffmpeg. Pure standard library (no numpy). Every source is CC0; see static/sounds/CREDITS.md.
"""
import array, json, math, os, subprocess, sys, urllib.request

SR = 44100
HOP = 220  # 5 ms
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "static", "sounds", "typewriter")

SOURCES = {
    "keys": ("164/164807_1460963", "https://freesound.org/people/exterminat/sounds/164807/", "exterminat"),
    "bell": ("204/204466_3430035", "https://freesound.org/people/NHumphrey/sounds/204466/", "NHumphrey"),
    "return": ("345/345955_191884", "https://freesound.org/people/knufds/sounds/345955/", "knufds"),
}


def path_for(dl, key):
    return os.path.join(dl, SOURCES[key][0].split("/")[1] + "-hq.mp3")


def download(dl):
    os.makedirs(dl, exist_ok=True)
    for key, (pid, _, _) in SOURCES.items():
        p = path_for(dl, key)
        if not os.path.exists(p):
            urllib.request.urlretrieve(f"https://cdn.freesound.org/previews/{pid}-hq.mp3", p)


def decode(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = array.array("h")
    a.frombytes(raw)
    return [s / 32768.0 for s in a]


def envelope(x):
    return [math.sqrt(sum(v * v for v in x[i:i + HOP]) / HOP) for i in range(0, len(x) - HOP, HOP)]


def onsets(env, rel=0.12, quiet_ms=40, refr_ms=70):
    peak = max(env) or 1
    thr = peak * rel
    quiet = quiet_ms * SR // 1000 // HOP
    refr = refr_ms * SR // 1000 // HOP
    out, last = [], -10**9
    for i in range(quiet, len(env)):
        if env[i] >= thr and env[i - 1] < thr and i - last > refr and max(env[i - quiet:i - 1]) < thr * 0.5:
            out.append(i)
            last = i
    return out


def zcr(seg):
    return sum(1 for a, b in zip(seg, seg[1:]) if (a < 0) != (b < 0)) / max(1, len(seg))


def hits(x, max_ms=220):
    env = envelope(x)
    ons = onsets(env)
    res = []
    for k, o in enumerate(ons):
        start = max(0, o * HOP - SR * 3 // 1000)
        nxt = ons[k + 1] * HOP - SR * 5 // 1000 if k + 1 < len(ons) else len(x)
        end = min(start + SR * max_ms // 1000, nxt)
        seg = x[start:end]
        if len(seg) < SR * 70 // 1000:
            continue
        head = seg[: len(seg) // 4] or seg
        tail = seg[len(seg) // 2:] or seg
        rms = lambda s: math.sqrt(sum(v * v for v in s) / len(s))
        res.append({"start": start / SR, "dur": len(seg) / SR, "peak": max(abs(v) for v in seg), "zcr": zcr(seg),
                    "decay": rms(tail) / (rms(head) or 1)})
    return res


def encode(x, start, dur, dst, fade_out=0.04, target_db=-3.0):
    """Cuts x[start, start+dur] (seconds), peak-normalizes to target_db, fades and encodes MP3.

    Samples are piped to ffmpeg so the cut is sample-exact (MP3 seeking is not)."""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    seg = x[int(start * SR): int((start + dur) * SR)]
    gain = 10 ** (target_db / 20) / max(max(abs(v) for v in seg), 1e-4)
    pcm = array.array("h", (max(-32767, min(32767, int(v * gain * 32767))) for v in seg))
    af = f"afade=t=in:d=0.002,afade=t=out:st={max(0, len(seg) / SR - fade_out):.3f}:d={fade_out}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-af", af, "-b:a", "96k", dst], input=pcm.tobytes(), check=True)


def spread(items, n):
    """Picks n items evenly spread through the recording (different keys, same machine)."""
    items = sorted(items, key=lambda h: h["start"])
    if len(items) <= n:
        return items
    step = len(items) / n
    return [items[int(i * step)] for i in range(n)]


def main():
    dl = sys.argv[1]
    download(dl)
    if "--analyze" in sys.argv:
        for key in SOURCES:
            hs = hits(decode(path_for(dl, key)), 3000)
            print(key, len(hs), json.dumps(hs[:12], indent=None))
        return

    manifest = {"keys": [], "space": [], "backspace": [], "bell": [], "return": []}
    for key in ("keys",):
        src = path_for(dl, key)
        # Clean key strikes are short and die away fast; long or sustained hits are carriage/ratchet noise.
        x = decode(src)
        hs = [h for h in hits(x) if h["dur"] >= 0.1 and h["decay"] < 0.35]
        loud = sorted(hs, key=lambda h: -h["peak"])[: max(12, len(hs) // 2)]
        by_zcr = sorted(loud, key=lambda h: h["zcr"])
        n_keys = 12
        space, back = by_zcr[:1], by_zcr[-1:]
        regular = spread([h for h in loud if h not in space and h not in back], n_keys)
        for i, h in enumerate(regular):
            name = f"key-{len(manifest['keys']) + 1:02d}.mp3"
            encode(x, h["start"], min(h["dur"], 0.2), os.path.join(OUT, name))
            manifest["keys"].append(name)
        for h in space:
            name = f"space-{len(manifest['space']) + 1}.mp3"
            encode(x, h["start"], min(h["dur"], 0.22), os.path.join(OUT, name))
            manifest["space"].append(name)
        for h in back:
            name = f"backspace-{len(manifest['backspace']) + 1}.mp3"
            encode(x, h["start"], min(h["dur"], 0.2), os.path.join(OUT, name), target_db=-5.0)
            manifest["backspace"].append(name)

    bell_x = decode(path_for(dl, "bell"))
    bell_env = envelope(bell_x)
    # The ding rises over a few hops, so take the first hop above 12 % of the peak.
    b0 = next(i for i, v in enumerate(bell_env) if v >= max(bell_env) * 0.12) * HOP / SR
    encode(bell_x, max(0, b0 - 0.003), 1.3, os.path.join(OUT, "bell.mp3"), fade_out=0.35, target_db=-6.0)
    manifest["bell"].append("bell.mp3")

    ret = decode(path_for(dl, "return"))
    r_hits = hits(ret, 3000)
    # The recording is "bell, then carriage reset": the first isolated hit is the lever pull.
    r0 = r_hits[0]["start"] - 0.05
    encode(ret, max(0, r0), min(1.25, len(ret) / SR - r0), os.path.join(OUT, "return.mp3"), fade_out=0.2, target_db=-4.0)
    manifest["return"].append("return.mp3")

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
