# FaceFort Architecture

## System Overview

FaceFort is an offline-first biometric authentication engine built on Expo SDK 54.
Total model package: **~7.2MB** (under the 20MB constraint).

```mermaid
graph TD
    A["📱 React Native App"] --> B["🎥 Camera Module"]
    A --> C["🧠 ML Pipeline"]
    A --> D["🗄️ Encrypted DB"]
    A --> E["🔐 Security Layer"]
    
    B --> C
    C --> F["YuNet<br/>Face Detection<br/>0.33MB"]
    C --> G["MobileFaceNet<br/>Recognition<br/>4.1MB"]
    C --> H["SilentFAS<br/>Passive Liveness<br/>2.4MB"]
    C --> I["MediaPipe<br/>Active Liveness<br/>3.5MB"]
    
    G --> J["512-D Embedding"]
    J --> K["Cosine Similarity<br/>Multi-Angle Match"]
    
    D --> L["expo-sqlite<br/>SQLCipher"]
    E --> M["AES-256-GCM"]
    E --> N["HMAC-SHA256"]
```

## Self-Enrollment Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant A as 📱 App
    participant C as 🎥 Camera
    participant M as 🧠 ML Pipeline
    participant DB as 🗄️ Database

    Note over A: First Launch Detection
    A->>U: Welcome Screen
    U->>A: Enter Name
    
    loop 7 Angle Captures
        A->>U: Show angle guide (straight, left, right, up, down, bright, shadow)
        U->>C: Position face
        C->>M: Capture frame
        M->>M: YuNet detect → Align → Preprocess
        M->>M: MobileFaceNet → 512-D embedding
        M->>A: Return embedding
    end
    
    A->>A: Encrypt 7 embeddings (AES-256-GCM)
    A->>DB: Store encrypted embedding blob
    A->>U: ✅ Enrollment Complete → Dashboard
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant C as 🎥 Camera
    participant D as 🔍 Detector
    participant L as 🛡️ Liveness
    participant R as 🧠 Recognizer
    participant DB as 🗄️ Database

    U->>C: Open Camera
    C->>D: Frame → YuNet Detection (~15ms)
    D->>L: Face crop → SilentFAS Passive (~80ms)
    
    alt Spoof Detected
        L->>U: 🚫 Spoof Alert
    else Real Face
        L->>R: Aligned face → MobileFaceNet (~60ms)
        R->>R: Extract 512-D embedding
        R->>DB: Decrypt stored embeddings
        R->>R: Cosine similarity × 7 angles
        
        alt Match Found (>0.65)
            R->>DB: Log attendance (HMAC signed)
            R->>U: ✅ Identity Verified + Confidence
        else No Match
            R->>U: ❌ Not Recognized
        end
    end
```

## Database Schema

| Table | Purpose | Encryption |
|-------|---------|-----------|
| `personnel` | Enrolled users + encrypted embeddings | AES-256-GCM on embedding_blob |
| `attendance_logs` | Authentication records | HMAC-SHA256 on log_hash |
| `sync_queue` | Pending sync items | Payload encrypted |
| `app_state` | Key-value config | Database-level SQLCipher |

## Security Architecture

1. **Storage Encryption**: SQLCipher full-database encryption
2. **Embedding Encryption**: AES-256-GCM per embedding blob
3. **Record Integrity**: HMAC-SHA256 signed attendance records
4. **Anti-Spoof**: Dual-layer passive + active liveness detection
5. **Lockout**: 3 failed attempts → 30-second lockout
6. **Key Storage**: Hardware-backed (expo-secure-store)

## Model Budget

| Model | Size | Input | Output | Latency |
|-------|------|-------|--------|---------|
| YuNet | 0.33MB | 160×160×3 | BBoxes + 5 landmarks | ~15ms |
| MobileFaceNet | 4.1MB | 112×112×3 | 512-D embedding | ~60ms |
| SilentFAS | 2.4MB | 80×80×3 | [real_prob, spoof_prob] | ~80ms |
| FaceLandmarker | 3.5MB | 192×192×3 | 468 landmarks | ~90ms |
| **Total** | **~7.2MB** | | | **~350ms** |

## Tech Stack

- **Framework**: Expo SDK 54 + React Native 0.81
- **Navigation**: expo-router (file-based)
- **State**: Zustand
- **Camera**: expo-camera (CameraView)
- **ML Inference**: react-native-fast-tflite (JSI/Nitro)
- **Database**: expo-sqlite + SQLCipher
- **Crypto**: expo-crypto + crypto utilities
- **UI**: react-native-reanimated + expo-linear-gradient
