#!/usr/bin/env python3
"""
FaceFort Model Downloader
=========================
Downloads all required ML models for the FaceFort offline facial recognition system.

Models:
1. YuNet Face Detector (~0.33MB) - OpenCV Zoo
2. MobileFaceNet Face Recognizer (~4.1MB, will be quantized) - From pretrained TFLite
3. SilentFAS Passive Liveness (~2.4MB) - Minivision
4. MediaPipe FaceLandmarker (~3.5MB) - Google MediaPipe

Usage:
    python scripts/download_models.py
"""

import os
import sys
import urllib.request
import hashlib

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "assets", "models")

MODELS = [
    {
        "name": "face_detection_yunet_2023mar.onnx",
        "url": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "description": "YuNet Face Detector (ONNX) - 0.33MB - Will need onnx2tf conversion",
        "size_mb": 0.33,
    },
    {
        "name": "mobilefacenet.tflite",
        "url": "https://github.com/nicholaskgeorge/Real-Time-Face-Recognition-Using-Mobile-Net/raw/master/facenet_512.tflite",
        "description": "MobileFaceNet 512-dim TFLite - ~4MB (pre-quantized version)",
        "size_mb": 4.1,
    },
    {
        "name": "face_landmarker.task",
        "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
        "description": "MediaPipe FaceLandmarker (float16) - ~3.5MB",
        "size_mb": 3.5,
    },
]

# SilentFAS requires a different approach - it's a PyTorch model that needs conversion
SILENT_FAS_NOTE = """
NOTE: SilentFAS (passive liveness) model requires manual steps:
1. Clone: git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
2. Download model weights from their README's Google Drive link
3. Run the export script (scripts/export_silent_fas.py) to convert to TFLite

For hackathon, you can use a placeholder or the anti-spoofing model from:
https://github.com/nicholaskgeorge/Real-Time-Face-Recognition-Using-Mobile-Net
"""


def download_file(url: str, dest: str, description: str) -> bool:
    """Download a file with progress reporting."""
    print(f"\n📥 Downloading: {description}")
    print(f"   URL: {url}")
    print(f"   Dest: {dest}")

    if os.path.exists(dest):
        print(f"   ✅ Already exists, skipping.")
        return True

    try:
        # Create a request with a User-Agent header to avoid 403 errors
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        
        with urllib.request.urlopen(req, timeout=60) as response:
            total = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 8192

            with open(dest, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = (downloaded / total) * 100
                        bar = "█" * int(pct // 2) + "░" * (50 - int(pct // 2))
                        print(f"\r   [{bar}] {pct:.1f}% ({downloaded}/{total})", end="")
            
            print(f"\n   ✅ Downloaded successfully ({downloaded / 1024 / 1024:.2f} MB)")
            return True

    except Exception as e:
        print(f"\n   ❌ Failed: {e}")
        if os.path.exists(dest):
            os.remove(dest)
        return False


def main():
    print("=" * 60)
    print("  FaceFort Model Downloader")
    print("=" * 60)

    os.makedirs(MODELS_DIR, exist_ok=True)
    print(f"\nModels directory: {MODELS_DIR}")

    results = []
    for model in MODELS:
        dest = os.path.join(MODELS_DIR, model["name"])
        success = download_file(model["url"], dest, model["description"])
        results.append((model["name"], success))

    # Create a placeholder for SilentFAS
    silent_fas_path = os.path.join(MODELS_DIR, "silent_fas.tflite")
    if not os.path.exists(silent_fas_path):
        print(f"\n⚠️  SilentFAS placeholder created at: {silent_fas_path}")
        print(SILENT_FAS_NOTE)
        # Create an empty placeholder
        with open(silent_fas_path + ".README.txt", "w") as f:
            f.write(SILENT_FAS_NOTE)

    print("\n" + "=" * 60)
    print("  Download Summary")
    print("=" * 60)
    for name, success in results:
        status = "✅" if success else "❌"
        print(f"  {status} {name}")

    print(f"\n  ⚠️  silent_fas.tflite - Requires manual conversion (see README)")
    print(f"\nModels saved to: {MODELS_DIR}")
    
    # Check if onnx2tf is needed
    yunet_onnx = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
    yunet_tflite = os.path.join(MODELS_DIR, "yunet.tflite")
    if os.path.exists(yunet_onnx) and not os.path.exists(yunet_tflite):
        print(f"\n⚠️  YuNet ONNX needs conversion to TFLite:")
        print(f"   pip install onnx2tf onnx tensorflow")
        print(f"   onnx2tf -i {yunet_onnx} -o {MODELS_DIR}")
        print(f"   Then rename the output to yunet.tflite")


if __name__ == "__main__":
    main()
