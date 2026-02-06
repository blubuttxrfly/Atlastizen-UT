# Gyro Starflyer – ComfyUI Production Playbook

Authoritative checklist for building the three Gyro Starflyer renders with ComfyUI + SDXL + ControlNet on Apple Silicon. Follow each section sequentially; everything downstream assumes the previous steps are complete.

---

## 1. Prerequisites

- **Hardware**: Apple Silicon Mac with ≥32 GB RAM recommended; ensure macOS 13+ for stable Metal drivers.
- **Software**: Xcode command-line tools, Python 3.10.x (system / `pyenv`), Homebrew for auxiliary utilities (`wget`, `ffmpeg` if needed).
- **Assets** (download separately before launching ComfyUI):
  - `sd_xl_base_1.0.safetensors`
  - `sd_xl_refiner_1.0.safetensors`
  - ControlNet SDXL `lineart` + `depth` weights
  - (Optional) IP-Adapter SDXL
  - Three cleaned high-contrast line-art sketches (Hero, Underside, Facet)
  - Corresponding depth maps (or single sketch reused with generated depth)

Create directories:

```bash
mkdir -p ~/AI/comfy/ComfyUI/models/{checkpoints,controlnet,ipadapter}
cp /path/to/sd_xl_base_1.0.safetensors ~/AI/comfy/ComfyUI/models/checkpoints/
cp /path/to/sd_xl_refiner_1.0.safetensors ~/AI/comfy/ComfyUI/models/checkpoints/
cp /path/to/controlnet/sdxl_lineart.safetensors ~/AI/comfy/ComfyUI/models/controlnet/
cp /path/to/controlnet/sdxl_depth.safetensors ~/AI/comfy/ComfyUI/models/controlnet/
```

Keep sketches/depth PNGs under `~/AI/comfy/StarflyerReferences/` for easy loading.

---

## 2. Environment Setup (one-time)

1. **Clone or update ComfyUI**  
   ```bash
   cd ~/AI/comfy
   git clone https://github.com/comfyanonymous/ComfyUI.git   # skip if already cloned
   cd ComfyUI
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
2. **Metal/MPS verification** – run inside the venv:
   ```bash
   python - <<'PY'
   import torch
   print("MPS available:", torch.backends.mps.is_available())
   print("MPS built:", torch.backends.mps.is_built())
   PY
   ```
   Both should print `True`. If not, update macOS / PyTorch (`pip install torch==2.2.1 --extra-index-url https://download.pytorch.org/whl/cpu` currently bundles MPS).
3. **Quality-of-life packages**:  
   ```bash
   pip install invisible-watermark opencv-python
   ```
4. **Launch shortcut** – drop in `~/AI/comfy/ComfyUI/run.sh`:
   ```bash
   #!/bin/zsh
   cd ~/AI/comfy/ComfyUI
   source .venv/bin/activate
   python main.py
   ```
   `chmod +x run.sh` for quick launches.

---

## 3. Launch & Interface

1. `~/AI/comfy/ComfyUI/run.sh`
2. Wait for `Running on http://127.0.0.1:8188/`. Metal initialization log should mention `MPS`.
3. Open the URL in a browser (Arc/Safari/Chrome). Enable *Settings → System → Save previews to disk* for audit history.

---

## 4. Workflow Topology Overview

For each frame we need:

- **Prompting stack**: SDXL base text encoder → KSampler (DPM++ 2M Karras) → VAE decode.
- **Control stack**: Two ControlNet branches (Lineart + Depth) feeding the base sampler.
- **Refinement**: SDXL Refiner (second KSampler with `denoise_strength 0.25`).
- **Seed discipline**: `Seed = 4321` across all samplers (base + refiner) and any latent noise nodes.

Recommended ComfyUI node groups (build once, then duplicate for each shot):

1. `Load Checkpoint` (SDXL base) → `CLIP Text Encode (Prompt)` + `CLIP Text Encode (Negative Prompt)` → `KSampler`.
2. `Image Input` (lineart sketch) → `ControlNet Loader (lineart)` → `ControlNet Apply Advanced`.
3. `Image Input` (depth map) → `ControlNet Loader (depth)` → `ControlNet Apply Advanced`.
4. Merge ControlNet outputs into the `KSampler` `control` input.
5. `Empty Latent Image` (match resolution) feeds `KSampler`.
6. `VAE Decode` → `Save Image`.
7. Refiner branch: use `Convert Image to Latent` → `Load Checkpoint` (SDXL Refiner) → `KSampler (refiner)` with `denoise 0.25` → `VAE Decode` → `Save Image`.

Tip: use `Reroute` nodes to keep the graph readable. After the base workflow is solid, duplicate the entire block twice (Hero, Underside, Facet) so each scene has isolated prompts/resolutions but shares the same control images (if desired) via `Image Save/Load` nodes.

---

## 5. Global Settings

| Setting | Value / Notes |
| --- | --- |
| Seed | `4321` (lock everywhere) |
| Base sampler | `DPM++ 2M Karras`, `steps 40`, `CFG 5.5`, `denoise 1.0` |
| Refiner sampler | `DPM++ 2M Karras`, `steps 16`, `CFG 5.0`, `denoise 0.25` |
| VAE precision | `fp16` |
| Clip skip | `2` |
| Scheduler | Leave default Karras; ensure `eta=1.0` |
| Negative prompt | `blurry, low detail, extra props, open propellers, exposed wiring mess, asymmetry, warped geometry, non-spherical dome, text, watermark, logo, overexposed highlights, cartoon, painterly, plastic toy look, noisy background` |

**ControlNet weights**:

- Lineart: weight `0.85`, start `0.0`, end `0.6`
- Depth: weight `0.55`, start `0.1`, end `1.0`

Increase Lineart to `0.90` + CFG `6.5` if geometry drifts. Reduce Depth to `0.45` if shading becomes muddy.

---

## 6. Image-Specific Configuration

### 6.1 Hero Cutaway (Isometric Studio)

- **Resolution**: `1536 × 864`
- **Prompt**:
  ```
  A highly detailed photoreal 3D cutaway of the Gyro Starflyer Omni eVTOL-submersible in a neutral gray studio, isometric three-quarter view from above-front-left. Hex-wing saucer diameter about 11 m with six facets, each facet containing two vertically stacked shrouded electric ducted fans (twelve total) with morphing louver exits. Perfect spherical transparent cabin 3.9 m made of layered sapphire moth-eye AR velvet sheen, ALON 4 mm, graded interphase, Spinel 12 mm, index-match gel with HexaMorph spectral emitter, PC/AS inner ply micro-heaters. Central Vector Core at bottom center showing axial rotor, smart bellmouth, vector sleeve, pump-jet stator pack. HexaMorph honeycomb skin tiles 7-9 cm shimmering, satin carbon fiber / titanium structure, ceramic-graphite louvers, landing legs stowed, entrance ramp connecting to the sphere iris, subtle teal-turquoise and soft green HUD glow with nine-seat arc interior and forward-starboard companion perch. Clean studio HDRI lighting, sharp micro-speculars, no text.
  ```
- **Notes**: Keep landing legs hidden (adjust ControlNet sketch accordingly). Verify entrance ramp contact point with cabin.

### 6.2 Underside Exploded (Movement Focus)

- **Resolution**: `1536 × 864`
- **Prompt**:
  ```
  Photoreal bottom exploded cutaway of the Gyro Starflyer Omni eVTOL-submersible showing a hexagon planform within the saucer, each of the six facets exposing two lower shrouded duct outlets (twelve total) and ghosted upper ducts above them. Large Central Vector Core centered with axial rotor, bellmouth intake, vector sleeve, pump-jet stators. Landing legs deployed in tripod stance with gecko pads, entrance bridge retracted, HexaMorph honeycomb skin smooth around louver openings, satin carbon/titanium structure, ceramic-graphite louvers, crisp rim-lit studio HDRI, no text.
  ```
- **Notes**: Ensure ControlNet sketch shows exploded offsets to encourage separation. Legs must be fully deployed.

### 6.3 Facet Close-up (Macro Cutaway)

- **Resolution**: `1344 × 1344` (square macro) or `1536 × 1024` if you prefer wide.
- **Prompt**:
  ```
  Macro orthographic cutaway of a single Gyro Starflyer saucer facet showing two vertically stacked shrouded ducts: upper fan near outer skin with morphing louver exit, lower fan near lower skin with side/bottom louver. Visible vector petal hinges, actuator linkages, organized cable and coolant routing. Exterior HexaMorph honeycomb tiles 7-9 cm partially lifted revealing sensor/emitter layer and index-match gel cell. Satin carbon/titanium structure, ceramic-graphite louvers, subtle anti-reflective sheen from the sapphire cabin glimpsed in the background, shallow depth of field, photoreal studio lighting, no text.
  ```
- **Notes**: Maintain orthographic feel—set camera hints in prompt (`orthographic macro`).

---

## 7. ControlNet Asset Prep

1. **Lineart**: vector or raster, 4k PNG recommended. Increase contrast (Levels → push blacks/whites) so ControlNet reads structure. Remove notes/text.
2. **Depth Map**:
   - Option A: Import lineart into Blender (simple 3D block-out), export depth pass via Eevee.
   - Option B: Use ComfyUI’s `Depth Map Preprocessor` node (`Midas` or `LeReS`) on a quick proxy render.
   - Ensure the depth png matches the exact resolution of the lineart to prevent ControlNet misalignment.
3. Save each pair as `hero_lineart.png`, `hero_depth.png`, etc.

---

## 8. Execution Checklist per Shot

1. Load reference images into `Load Image` nodes.
2. Set `Empty Latent Image` to target resolution.
3. Paste prompt + negative prompt.
4. Confirm ControlNet weights.
5. Hit `Queue Prompt`.
6. Inspect base output; if geometry holds, send to refiner (or have refiner chained automatically).
7. Save outputs (ComfyUI auto dumps into `ComfyUI/output/`). Rename immediately:  
   `HeroCutaway_seed4321.png`, `HeroCutaway_refined.png`, etc.
8. Repeat for Underside + Facet.

---

## 9. Validation Against Acceptance Checklist

- Cabin reads as perfect sphere with velvet AR sheen.
- Count twelve fans (two per facet) clearly.
- Central Vector Core larger than facet fans, bellmouth + stators visible.
- HexaMorph tiles recognizable in all frames.
- Entrance ramp only visible (and touching sphere) in Hero shot.
- Landing legs: stowed (Hero), deployed (Underside). None visible in macro unless intended.
- Color grade: neutral studio, clean speculars, no text overlays.

If any criterion fails, adjust ControlNet weights or prompt language and re-queue.

---

## 10. Troubleshooting & Tweaks

| Issue | Fix |
| --- | --- |
| **VRAM crash / `MPS allocation failed`** | Lower resolution to `1344 × 768`, drop steps to `32`, disable preview, ensure no background apps hog GPU. |
| **Cabin not spherical** | Increase Lineart weight, mention “perfect sphere” twice, add `geometry-locked spherical cabin` to prompt. |
| **AR sheen too glossy** | Add `velvet anti-reflective finish, soft diffusion` to prompt; reduce HDRI intensity; lower CFG to `5.0`. |
| **Fans missing / count wrong** | Explicitly say `each of the six facets clearly shows two stacked ducts (twelve total)`; push ControlNet lineart clarity. |
| **Noise/grain** | Increase steps to `44`, enable VAE tiling, or run `Image Sharpen` post-process lightly. |
| **Depth overpowering** | Reduce depth ControlNet weight to `0.45` or shorten end to `0.8`. |

---

## 11. Optional Automation

- **Batch reruns**: Use ComfyUI’s `Queue Size` to launch multiple seeds (but keep 4321 for canonical set).
- **Metadata logging**: Enable `Save metadata to PNG`. Later, `python scripts/metadata_dump.py <image>` to review.
- **Versioning**: Copy `ComfyUI/custom_nodes/` workflow JSON to `~/AI/comfy/StarflyerWorkflows/gyro_starflyer_v1.json`.

---

## 12. Wrap-Up & Delivery

1. Collect final PNGs (base + refined) and metadata snapshots.
2. Package with sketches + depth maps for archive.
3. Document deviations (if any) inside a short README so future passes know what was tuned.

You now have the full playbook—run the workflow, confirm against the checklist, and the Gyro Starflyer campaign is complete. Safe flights! 🚀
