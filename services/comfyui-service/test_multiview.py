"""Validação standalone: Hy3DGenerateMeshMultiView com o modelo BASE (sem download 2mv).

Alimenta front/right/back/left (já em ComfyUI/input) → reconstrói malha .glb.
"""
import json, time, urllib.request, sys

COMFY = "http://127.0.0.1:8188"
DIT = "model.fp16.safetensors"


def build(views, steps=30, guidance=5.5, seed=42, octree=256, max_faces=40000):
    g = {"L_front": {"class_type": "LoadImage", "inputs": {"image": "front.png"}},
         "L_right": {"class_type": "LoadImage", "inputs": {"image": "right.png"}},
         "L_back": {"class_type": "LoadImage", "inputs": {"image": "back.png"}},
         "L_left": {"class_type": "LoadImage", "inputs": {"image": "left.png"}},
         "2": {"class_type": "Hy3DModelLoader", "inputs": {"model": DIT}}}
    mv_inputs = {"pipeline": ["2", 0], "guidance_scale": guidance, "steps": steps, "seed": seed}
    for v in views:
        mv_inputs[v] = [f"L_{v}", 0]
    g["3"] = {"class_type": "Hy3DGenerateMeshMultiView", "inputs": mv_inputs}
    g["4"] = {"class_type": "Hy3DVAEDecode", "inputs": {
        "vae": ["2", 1], "latents": ["3", 0], "box_v": 1.01,
        "octree_resolution": octree, "num_chunks": 8000, "mc_level": 0.0, "mc_algo": "mc"}}
    g["5"] = {"class_type": "Hy3DPostprocessMesh", "inputs": {
        "trimesh": ["4", 0], "remove_floaters": True, "remove_degenerate_faces": True,
        "reduce_faces": True, "max_facenum": max_faces, "smooth_normals": False}}
    g["6"] = {"class_type": "Hy3DExportMesh", "inputs": {
        "trimesh": ["5", 0], "filename_prefix": "3D/MV_test", "file_format": "glb"}}
    return g


def post(graph):
    data = json.dumps({"prompt": graph}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def main():
    views = ["front", "right", "back", "left"]
    print(f"[mv] submetendo multiview com {len(views)} vistas: {views}")
    r = post(build(views))
    pid = r["prompt_id"]
    print(f"[mv] prompt_id={pid}")
    t0 = time.time()
    # multiview (4 vistas) é pesado na AMD/ZLUDA: ~20 min na 1ª vez. Margem generosa.
    while time.time() - t0 < 1800:
        time.sleep(4)
        try:
            h = json.loads(urllib.request.urlopen(f"{COMFY}/history/{pid}", timeout=15).read())
        except Exception as e:
            print(f"[mv] poll erro: {e}"); continue
        if pid in h:
            entry = h[pid]
            st = entry.get("status", {})
            print(f"[mv] status={st.get('status_str')} completed={st.get('completed')} t={int(time.time()-t0)}s")
            if st.get("completed"):
                outs = entry.get("outputs", {})
                print("[mv] OUTPUTS:", json.dumps(outs, indent=2)[:1500])
                return
            if st.get("status_str") == "error":
                print("[mv] ERRO:", json.dumps(entry.get("status"), indent=2)[:2000])
                for m in st.get("messages", []):
                    print("   msg:", m)
                return
    print("[mv] timeout")


if __name__ == "__main__":
    main()
