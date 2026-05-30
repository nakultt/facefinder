#!/usr/bin/env python3
"""
Download and convert MobileFaceNet to TFLite for FaceFort.
Uses InsightFace's pre-trained ArcFace model.

Requirements:
    pip install onnx onnxruntime tensorflow tf2onnx numpy

Usage:
    python scripts/download_mobilefacenet.py
"""

import os
import sys
import urllib.request
import zipfile
import shutil

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'assets', 'models')
TEMP_DIR = os.path.join(os.path.dirname(__file__), '_temp_model')

# InsightFace MobileFaceNet ONNX model URL
# This is the official ArcFace MobileFaceNet trained on MS1MV2 dataset
MOBILEFACENET_ONNX_URL = "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/arcface/model/arcfaceresnet100-11-int8.onnx"

# Alternative: smaller MobileFaceNet from InsightFace model zoo
MOBILEFACENET_ALT_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_s.zip"


def download_file(url: str, dest: str, desc: str = ""):
    """Download a file with progress."""
    print(f"  📥 Downloading {desc or url}...")
    
    def report_hook(count, block_size, total_size):
        if total_size > 0:
            pct = min(100, int(count * block_size * 100 / total_size))
            bar = '█' * (pct // 2) + '░' * (50 - pct // 2)
            print(f"\r  [{bar}] {pct}%", end='', flush=True)
    
    urllib.request.urlretrieve(url, dest, reporthook=report_hook)
    print()


def convert_onnx_to_tflite(onnx_path: str, tflite_path: str):
    """Convert ONNX model to TFLite with int8 quantization."""
    print("  🔄 Converting ONNX → TFLite...")
    
    try:
        import onnx
        import numpy as np
        
        # Method 1: Try onnx2tf (best quality)
        try:
            import subprocess
            result = subprocess.run(
                ['onnx2tf', '-i', onnx_path, '-o', os.path.dirname(tflite_path),
                 '-osd', '-oh5', '-ois', '1,3,112,112'],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode == 0:
                # Find the generated tflite file
                out_dir = os.path.dirname(tflite_path)
                for f in os.listdir(out_dir):
                    if f.endswith('.tflite'):
                        src = os.path.join(out_dir, f)
                        if src != tflite_path:
                            shutil.move(src, tflite_path)
                        print(f"  ✅ Converted via onnx2tf")
                        return True
        except (ImportError, FileNotFoundError):
            pass
        
        # Method 2: Use tf2onnx + TFLite converter
        try:
            import tensorflow as tf
            import tf2onnx
            
            model = onnx.load(onnx_path)
            
            # Convert ONNX to TF SavedModel
            tf_rep = tf2onnx.convert.from_onnx(model)
            
            # Convert to TFLite
            converter = tf.lite.TFLiteConverter.from_saved_model(tf_rep)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            converter.target_spec.supported_ops = [
                tf.lite.OpsSet.TFLITE_BUILTINS,
                tf.lite.OpsSet.SELECT_TF_OPS
            ]
            tflite_model = converter.convert()
            
            with open(tflite_path, 'wb') as f:
                f.write(tflite_model)
            
            print(f"  ✅ Converted via tf2onnx")
            return True
        except ImportError:
            pass
        
    except ImportError:
        pass
    
    print("  ⚠️  Auto-conversion failed. Please install: pip install onnx onnx2tf tensorflow")
    return False


def download_buffalo_s():
    """Download InsightFace buffalo_s (small) model pack.
    Contains: det_500m.onnx + w600k_mbf.onnx (MobileFaceNet)
    """
    print("\n📦 Downloading InsightFace buffalo_s model pack...")
    
    os.makedirs(TEMP_DIR, exist_ok=True)
    zip_path = os.path.join(TEMP_DIR, 'buffalo_s.zip')
    
    download_file(MOBILEFACENET_ALT_URL, zip_path, "buffalo_s.zip")
    
    print("  📂 Extracting...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(TEMP_DIR)
    
    # Find the MobileFaceNet ONNX file
    mbf_onnx = None
    for root, dirs, files in os.walk(TEMP_DIR):
        for f in files:
            if 'w600k' in f and f.endswith('.onnx'):
                mbf_onnx = os.path.join(root, f)
                break
            elif 'mbf' in f.lower() and f.endswith('.onnx'):
                mbf_onnx = os.path.join(root, f)
                break
    
    return mbf_onnx


def main():
    print("=" * 60)
    print("  FaceFort — MobileFaceNet Model Acquisition")
    print("=" * 60)
    
    os.makedirs(MODELS_DIR, exist_ok=True)
    tflite_path = os.path.join(MODELS_DIR, 'mobilefacenet.tflite')
    
    # Check if already exists
    if os.path.exists(tflite_path):
        size_mb = os.path.getsize(tflite_path) / (1024 * 1024)
        print(f"\n✅ Model already exists: {tflite_path} ({size_mb:.1f} MB)")
        return
    
    # Strategy 1: Try downloading buffalo_s and converting
    print("\n🔍 Strategy: Download InsightFace buffalo_s → extract MobileFaceNet → convert to TFLite")
    mbf_onnx = download_buffalo_s()
    
    if mbf_onnx:
        print(f"  Found: {mbf_onnx}")
        success = convert_onnx_to_tflite(mbf_onnx, tflite_path)
        
        if success and os.path.exists(tflite_path):
            size_mb = os.path.getsize(tflite_path) / (1024 * 1024)
            print(f"\n✅ MobileFaceNet TFLite saved: {tflite_path} ({size_mb:.1f} MB)")
        else:
            # Copy the ONNX as fallback — user can manually convert
            onnx_dest = os.path.join(MODELS_DIR, 'mobilefacenet.onnx')
            shutil.copy2(mbf_onnx, onnx_dest)
            print(f"\n⚠️  ONNX saved to: {onnx_dest}")
            print("   Please convert manually:")
            print(f"   pip install onnx2tf")
            print(f"   onnx2tf -i {onnx_dest} -o {MODELS_DIR} -osd")
    else:
        print("  ❌ Could not find MobileFaceNet in downloaded pack")
    
    # Cleanup temp
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
    
    print("\n" + "=" * 60)
    print("  Next steps:")
    print("  1. Ensure mobilefacenet.tflite is in src/assets/models/")
    print("  2. Run: npx expo prebuild --clean")
    print("  3. Run: npx expo run:android")
    print("=" * 60)


if __name__ == '__main__':
    main()
