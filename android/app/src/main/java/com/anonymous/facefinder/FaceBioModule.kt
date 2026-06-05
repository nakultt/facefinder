package com.anonymous.facefinder

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class FaceBioModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  init {
    Log.w("FaceBioModule", "FaceBioModule: constructor invoked!")
    try {
      logToFile("FaceBioModule: constructor invoked!")
    } catch (e: Exception) {
      Log.e("FaceBioModule", "FaceBioModule: failed to log constructor to file: ${e.message}")
    }
  }

  override fun getName(): String = "FaceBio"

  private fun logToFile(message: String) {
    val dirs = listOfNotNull(
      reactApplicationContext.externalCacheDir,
      reactApplicationContext.filesDir,
      reactApplicationContext.cacheDir
    )
    for (dir in dirs) {
      try {
        if (!dir.exists()) dir.mkdirs()
        val logFile = java.io.File(dir, "app.log")
        logFile.appendText("[${System.currentTimeMillis()}] $message\n")
        return
      } catch (_: Exception) {}
    }
  }

  @ReactMethod
  fun extractEmbedding(imageUri: String, promise: Promise) {
    try {
      logToFile("extractEmbedding called for $imageUri")
      val gray = decodeFaceGray(imageUri, 32)
      val embedding = buildEmbedding(gray)
      val out = Arguments.createMap()
      val arr = Arguments.createArray()
      embedding.forEach { arr.pushDouble(it.toDouble()) }
      out.putBoolean("available", true)
      out.putArray("embedding", arr)
      out.putInt("dim", embedding.size)
      out.putDouble("quality", imageQuality(gray).toDouble())
      logToFile("extractEmbedding success: embedding size = ${embedding.size}")
      promise.resolve(out)
    } catch (e: Exception) {
      logToFile("extractEmbedding error: ${e.message}")
      val code = if (e.message?.contains("FACE_NOT_FOUND") == true) "FACE_NOT_FOUND" else "FACEBIO_EMBEDDING_FAILED"
      promise.reject(code, e.message ?: "Could not extract face descriptor", e)
    }
  }

  @ReactMethod
  fun evaluateLiveness(imageUris: com.facebook.react.bridge.ReadableArray, promise: Promise) {
    try {
      logToFile("evaluateLiveness called with ${imageUris.size()} images")
      val frames = mutableListOf<FloatArray>()
      for (i in 0 until imageUris.size()) {
        imageUris.getString(i)?.let { frames.add(decodeFaceGray(it, 32)) }
      }
      val motion = motionScore(frames)
      val quality = frames.map { imageQuality(it) }.average().toFloat()
      val score = max(0f, min(1f, (motion - 0.018f) / 0.055f)) * max(0.35f, min(1f, quality))
      val out = Arguments.createMap()
      out.putBoolean("available", true)
      out.putBoolean("passed", frames.size >= 2 && motion >= 0.028f && quality >= 0.18f)
      out.putDouble("score", score.toDouble())
      out.putDouble("motionScore", motion.toDouble())
      logToFile("evaluateLiveness success: motion=$motion, quality=$quality, score=$score, passed=${frames.size >= 2 && motion >= 0.028f && quality >= 0.18f}")
      promise.resolve(out)
    } catch (e: Exception) {
      logToFile("evaluateLiveness error: ${e.message}")
      val code = if (e.message?.contains("FACE_NOT_FOUND") == true) "FACE_NOT_FOUND" else "FACEBIO_LIVENESS_FAILED"
      promise.reject(code, e.message ?: "Could not evaluate liveness", e)
    }
  }

  private fun decodeFaceGray(imageUri: String, size: Int): FloatArray {
    logToFile("decodeFaceGray starting for $imageUri")
    val path = imageUri.removePrefix("file://")
    val opts = BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inSampleSize = 2
    }
    val decoded = BitmapFactory.decodeFile(path, opts)
      ?: throw IllegalArgumentException("Image could not be decoded")
    val rotated = rotateForExif(decoded, path)
    logToFile("Image decoded and rotated: size = ${rotated.width}x${rotated.height}")

    // Check if face exists in the rotated frame using Android's built-in FaceDetector.
    // FaceDetector requires RGB_565 and an even width.
    val detectWidth = if (rotated.width % 2 == 0) rotated.width else rotated.width - 1
    val detectHeight = rotated.height
    val faceBmp = Bitmap.createScaledBitmap(rotated, detectWidth, detectHeight, false).copy(Bitmap.Config.RGB_565, true)
    val detector = android.media.FaceDetector(detectWidth, detectHeight, 1)
    val faces = arrayOfNulls<android.media.FaceDetector.Face>(1)
    val numFaces = detector.findFaces(faceBmp, faces)
    faceBmp.recycle()
    logToFile("FaceDetector found $numFaces faces")
    if (numFaces == 0) {
      logToFile("No face detected error thrown")
      if (rotated != decoded) rotated.recycle()
      decoded.recycle()
      throw IllegalArgumentException("FACE_NOT_FOUND: No face detected in the image")
    }

    val side = (min(rotated.width, rotated.height) * 0.72f).toInt().coerceAtLeast(16)
    val left = ((rotated.width - side) / 2).coerceIn(0, max(0, rotated.width - side))
    val topBias = ((rotated.height - side) * 0.42f).toInt()
    val top = topBias.coerceIn(0, max(0, rotated.height - side))
    val cropped = Bitmap.createBitmap(rotated, left, top, side, side)
    val scaled = Bitmap.createScaledBitmap(cropped, size, size, true)
    val pixels = IntArray(size * size)
    scaled.getPixels(pixels, 0, size, 0, 0, size, size)
    val gray = FloatArray(size * size)
    var mean = 0f
    for (i in pixels.indices) {
      val p = pixels[i]
      val r = (p shr 16) and 255
      val g = (p shr 8) and 255
      val b = p and 255
      val y = (0.299f * r + 0.587f * g + 0.114f * b) / 255f
      gray[i] = y
      mean += y
    }
    mean /= gray.size
    var variance = 0f
    for (v in gray) variance += (v - mean) * (v - mean)
    val std = sqrt((variance / gray.size).coerceAtLeast(1e-6f))
    for (i in gray.indices) gray[i] = ((gray[i] - mean) / (std * 3f)).coerceIn(-1f, 1f)
    if (scaled != cropped) scaled.recycle()
    cropped.recycle()
    if (rotated != decoded) rotated.recycle()
    decoded.recycle()
    return gray
  }

  private fun rotateForExif(bitmap: Bitmap, path: String): Bitmap {
    val orientation = try {
      ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    } catch (_: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }
    val degrees = when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees == 0f) return bitmap
    val matrix = Matrix().apply { postRotate(degrees) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  private fun buildEmbedding(gray: FloatArray): FloatArray {
    val dct = dctFeatures(gray, 32, 16)
    val grad = gradientFeatures(gray, 32)
    val out = FloatArray(512)
    System.arraycopy(dct, 0, out, 0, 256)
    System.arraycopy(grad, 0, out, 256, 256)
    normalize(out)
    return out
  }

  private fun dctFeatures(gray: FloatArray, n: Int, keep: Int): FloatArray {
    val out = FloatArray(keep * keep)
    var index = 0
    for (u in 0 until keep) {
      for (v in 0 until keep) {
        var sum = 0.0
        for (x in 0 until n) {
          val cx = cos(((2 * x + 1) * u * PI) / (2.0 * n))
          for (y in 0 until n) {
            val cy = cos(((2 * y + 1) * v * PI) / (2.0 * n))
            sum += gray[y * n + x] * cx * cy
          }
        }
        out[index++] = (sum / n).toFloat()
      }
    }
    out[0] = 0f
    normalize(out)
    return out
  }

  private fun gradientFeatures(gray: FloatArray, n: Int): FloatArray {
    val blocks = 8
    val blockSize = n / blocks
    val out = FloatArray(blocks * blocks * 4)
    for (by in 0 until blocks) {
      for (bx in 0 until blocks) {
        val hist = FloatArray(4)
        val sx = bx * blockSize
        val sy = by * blockSize
        for (y in max(1, sy) until min(n - 1, sy + blockSize)) {
          for (x in max(1, sx) until min(n - 1, sx + blockSize)) {
            val dx = gray[y * n + x + 1] - gray[y * n + x - 1]
            val dy = gray[(y + 1) * n + x] - gray[(y - 1) * n + x]
            val mag = sqrt(dx * dx + dy * dy)
            val bucket = when {
              abs(dx) > abs(dy) && dx >= 0f -> 0
              abs(dx) > abs(dy) -> 1
              dy >= 0f -> 2
              else -> 3
            }
            hist[bucket] += mag
          }
        }
        val base = (by * blocks + bx) * 4
        for (i in 0 until 4) out[base + i] = hist[i]
      }
    }
    normalize(out)
    return out
  }

  private fun motionScore(frames: List<FloatArray>): Float {
    if (frames.size < 2) return 0f
    var total = 0f
    var pairs = 0
    for (i in 1 until frames.size) {
      val a = frames[i - 1]
      val b = frames[i]
      var diff = 0f
      for (j in a.indices) diff += abs(a[j] - b[j])
      total += diff / a.size
      pairs++
    }
    return total / pairs
  }

  private fun imageQuality(gray: FloatArray): Float {
    var mean = 0f
    for (v in gray) mean += v
    mean /= gray.size
    var variance = 0f
    for (v in gray) variance += (v - mean) * (v - mean)
    return sqrt(variance / gray.size).coerceIn(0f, 1f)
  }

  private fun normalize(values: FloatArray) {
    var norm = 0f
    for (v in values) norm += v * v
    norm = sqrt(norm).coerceAtLeast(1e-6f)
    for (i in values.indices) values[i] /= norm
  }
}
