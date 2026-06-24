# Deep Technical Analysis: Music, Audio, and Gaming Apps
## Spotify, Audible, HeroForge, Idle Games, Strategy Sims, and More

---

## PART 1: MUSIC & AUDIO STREAMING

---

## 1. SPOTIFY - MUSIC STREAMING

### What It Does
Music streaming service: browse 150M+ songs, create/share playlists, personalized recommendations, offline downloads, podcasts, social features.

### Technology Stack

**Backend Infrastructure**:
- **Language**: Java (primary), Scala (data processing), Node.js (lightweight services), Python (ML/analytics)
- **Framework**: Spring Framework (REST APIs), Apache Beam (batch processing)
- **Message Queue**: Apache Kafka (real-time event streaming)
- **Database**: Apache Cassandra (NoSQL, distributed), Redis (caching)
- **Cloud**: Google Cloud Platform (GCP), AWS (multi-cloud strategy)
- **Containerization**: Docker + Kubernetes
- **Search**: Elasticsearch
- **Data Processing**: Scio (Scala API for Apache Beam), BigQuery

**Frontend**:
- **Web**: React.js (JavaScript)
- **Desktop**: C++ (lightweight, efficient)
- **Mobile**: Native iOS/Android, React Native hybrid

**Audio Protocols**:
- **RTSP**: Real Time Streaming Protocol (legacy)
- **HLS**: HTTP Live Streaming
- **Proprietary**: Spotify's custom streaming protocol
- **Codecs**: Ogg Vorbis, MPEG, AAC

### Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                    User Tier (Web/Mobile)                   │
│  React Web / React Native / iOS / Android / Desktop (C++)   │
└──────────────────────┬─────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼─────┐  ┌────▼────┐  ┌─────▼─────┐
│   API        │  │ Auth    │  │ Streaming │
│ Gateway      │  │ Service │  │ Service   │
└───────┬─────┘  └────┬────┘  └─────┬─────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼──────┐ ┌─────▼──────┐
│ Recommendation│ │Playlist   │ │ Search     │
│ Engine        │ │Service    │ │ Service    │
└───────┬──────┘ └────┬──────┘ └─────┬──────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐         ┌─────────▼────────┐
│  Event Bus     │         │  Cache Layer     │
│  (Kafka)       │         │  (Redis)         │
└───────┬────────┘         └─────────┬────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────────┐      ┌─────────▼────────────┐
│ Cassandra DB       │      │ BigQuery            │
│ (User data,        │      │ (Analytics,         │
│  Playlists,        │      │  User behavior,     │
│  Streams)          │      │  Recommendations)   │
└────────────────────┘      └─────────────────────┘
```

### Data Structures

**User Profile**:
```json
{
  "userId": "spotify_user_xyz",
  "username": "musiclover42",
  "email": "user@example.com",
  "subscription": {
    "type": "premium", // free, premium
    "startDate": "2025-01-01T00:00:00Z",
    "renewalDate": "2026-01-01T00:00:00Z",
    "autoRenew": true
  },
  "preferences": {
    "explicitContent": true,
    "audioQuality": "high", // low, normal, high, very_high (lossless)
    "offlineSync": true,
    "privateSession": false
  },
  "followedArtists": 250,
  "followedUsers": 50,
  "followers": 125,
  "createdAt": "2024-06-15T10:30:00Z",
  "lastLogin": "2026-06-21T14:22:00Z"
}
```

**Track Stream**:
```json
{
  "trackId": "track_abc123",
  "userId": "spotify_user_xyz",
  "startTime": "2026-06-21T14:22:30Z",
  "endTime": "2026-06-21T14:27:15Z",
  "durationMs": 285000,
  "progress": 285000,
  "skipped": false,
  "device": {
    "id": "device_xyz",
    "name": "iPhone",
    "type": "smartphone"
  },
  "context": {
    "contextType": "playlist",
    "contextId": "playlist_summer_hits",
    "contextName": "Summer Hits"
  },
  "audioQuality": "high",
  "offline": false
}
```

**Personalized Recommendation**:
```json
{
  "userId": "spotify_user_xyz",
  "recommendationId": "rec_123",
  "algorithm": "collaborative_filtering", // or content_based, hybrid
  "playlist": {
    "playlistId": "rec_playlist_xyz",
    "name": "Discover Weekly",
    "description": "Your weekly personalized playlist",
    "generatedAt": "2026-06-15T00:00:00Z",
    "tracks": [
      {
        "trackId": "track_123",
        "artistId": "artist_456",
        "score": 0.89, // confidence that user will like (0-1)
        "reason": "based on your likes and similar listeners"
      }
    ],
    "updatedAt": "2026-06-15T00:00:00Z"
  }
}
```

### How Streaming Works

**Audio Streaming Pipeline**:

1. **User clicks play on a track**
   - Frontend sends: `POST /stream/{trackId}` with user_id, device_id
   - Server checks subscription rights (free tier has ads, premium skips ads)

2. **Licensing Check**:
   - Verify user's region supports this track (licensing varies by country)
   - Check if track available in user's subscription tier
   - If not available: return error or suggest alternative

3. **Audio Server Selection**:
   - User's device IP → determine CDN region closest to user
   - Select audio server in nearest data center
   - Reduce latency (stream starts within 1-2 seconds)

4. **Adaptive Bitrate Streaming**:
   - Measure user's bandwidth
   - Start streaming at medium quality
   - Adjust bitrate in real-time based on network speed:
     ```
     Low Bandwidth:  96 kbps (Ogg Vorbis)
     Normal:         160 kbps
     High:           320 kbps (lossy MP3/AAC)
     Very High:      Lossless (FLAC) - Premium only
     ```

5. **Chunk Download**:
   - Audio divided into 4-second chunks
   - Download chunks sequentially
   - If network drops: buffer 10-20 seconds ahead
   - If network improves: switch to higher bitrate chunks

6. **DRM Protection** (Digital Rights Management):
   - Audio encrypted on transmission
   - License key tied to user's account
   - Cannot download/copy/share without permission
   - Token expires after 30 days if premium lapses

7. **Offline Sync**:
   - User marks track as "available offline"
   - Device downloads encrypted copy
   - Stored locally with license token
   - Playback works without internet
   - License refresh needed monthly

### Real-time Analytics (Event-Driven)

**Kafka Event Stream**:
```
User_Stream_Event {
  timestamp: "2026-06-21T14:22:30Z",
  userId: "spotify_user_xyz",
  trackId: "track_abc123",
  artistId: "artist_456",
  playlistId: "playlist_xyz",
  durationMs: 285000,
  progress: 142500, // halfway through
  skipped: false,
  device: "smartphone",
  region: "US",
  audioQuality: "high"
}
```

**Processing Pipeline**:
1. Event published to Kafka topic: `user_stream_events`
2. Multiple consumers process:
   - **Real-time Metrics**: Update "currently playing" counts
   - **Recommendations**: Feed into ML models for personalization
   - **Analytics**: Aggregated for dashboards
   - **Billing**: Track for subscription compliance
3. Aggregate to BigQuery for long-term analysis

### Recommendation System

**Spotify Wrapped** (largest annual dataflow job):
- Query billions of user events from previous year
- Calculate:
  - Top artists (by listen time)
  - Top tracks
  - Top genres
  - Listening time distribution
  - New discoveries
- Use Sort Merge Bucket (SMB) optimization:
  - Pre-sort data by user_id
  - Merge sorted streams
  - Faster than unsorted shuffle-based join
  - Reduces cost by 40% vs. previous approach

**Personalization**:
- **Collaborative Filtering**: "Users like you listened to X"
  - Build user-similarity matrix
  - If User A and User B have 80% overlap in likes → recommend User B's favorite track to User A
- **Content-Based**: "Tracks similar to your favorites"
  - Analyze audio features (tempo, key, energy)
  - Text analysis of song titles/lyrics
  - Artist similarity
- **Hybrid**: Combine both approaches
  - Weight based on user feedback
  - A/B test which performs better

---

## 2. AUDIBLE - AUDIOBOOK PLATFORM

### What It Does
Audiobook subscription service: browse 750K+ titles, purchase/subscribe, narrated by professional actors, offline playback, speed adjustment (0.5x - 3x).

### Technology Stack
- **Platform**: Amazon/AWS infrastructure
- **Frontend**: Mobile-native (iOS, Android), Web player (browser-based)
- **Backend**: AWS Lambda, DynamoDB, S3
- **DRM**: Proprietary AAX/AAX+ format

### Data Structures

**Audiobook Metadata**:
```json
{
  "bookId": "audible_book_xyz",
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "narrator": "Jake Gyllenhaal",
  "publisher": "Penguin Audio",
  "duration": {
    "totalMinutes": 480,
    "chapters": 9
  },
  "category": "Classic Literature",
  "rating": {
    "average": 4.7,
    "count": 12500
  },
  "releaseDate": "2024-01-15",
  "price": 14.99,
  "available": true,
  "languages": ["en-US", "en-GB"],
  "format": {
    "encoding": "AAX+",
    "bitrate": "128 kbps",
    "drm": true
  },
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Chapter 1: In My Younger and More Vulnerable Years",
      "startTime": 0,
      "endTime": 3600 // seconds
    }
  ]
}
```

**User Listen Progress**:
```json
{
  "userId": "audible_user_abc",
  "bookId": "audible_book_xyz",
  "currentPosition": {
    "chapters": 3,
    "seconds": 1250 // 3:20 into chapter 3
  },
  "percentage": 28.5,
  "lastListenedDate": "2026-06-21T14:22:00Z",
  "duration": 480,
  "speed": 1.0, // playback speed multiplier
    "bookmarks": [
    {
      "position": 3600,
      "note": "Loved this quote"
    }
  ],
  "notes": "Amazing narration!"
}
```

### DRM (Digital Rights Management)

**Why Audible Uses DRM**:
- Protect author/narrator copyright
- Prevent unauthorized sharing
- Control access per account
- License tied to device/account

**How It Works**:
1. **Purchase Flow**:
   - User buys audiobook
   - Server generates license tied to user_id + device_id
   - License encrypted with user's account key

2. **Download**:
   - Audiobook compressed + encrypted in AAX format
   - Downloaded to device
   - License file also downloaded
   - Without license: file won't play

3. **Playback**:
   - App reads license (expiration, device binding)
   - Decrypt audio stream
   - Play through speaker
   - If license expired: "Please renew subscription"

4. **Device Binding**:
   - Can authorize up to 6 devices per account
   - Remove device → license revoked
   - License valid for 30 days offline
   - After 30 days without re-auth: DRM recheck required

### Anti-Piracy

**The Challenge**:
- Users want to own their purchases
- Publishers want control over distribution
- Result: DRM causes friction for legitimate users

**Current Status (2025-2026)**:
- Native Windows app discontinued (focus on mobile)
- Web player requires browser
- Third-party tools (OpenAudible) attempt to circumvent DRM
- Recording-based workarounds still possible (record playback to MP3)

### Offline Playback

**Download Architecture**:
```
Device Storage:
├── book_metadata.json
├── chapters/
│   ├── chapter_01.aax (encrypted)
│   ├── chapter_02.aax
│   └── ...
└── license.drm (tied to account + device)

Playback:
1. Load license.drm
2. Check: valid? in sync with server? (every 30 days)
3. For each chapter:
   a. Load chapter_XX.aax
   b. Decrypt using license key
   c. Stream to audio player
   d. Seek/pause/resume normally
```

---

## PART 2: GAMING & ENTERTAINMENT APPS

---

## 1. HEROFORGE - 3D CHARACTER CREATOR

### What It Does
Browser-based 3D character creator for tabletop miniatures. Users design fantasy characters, export as physical minis (3D printed), STL files, or digital avatars for VTTs.

### Technology Stack

**Frontend**:
- **3D Rendering**: WebGL (direct GPU access via browser)
- **3D Engine**: Three.js (JavaScript 3D library)
- **UI Framework**: React or similar
- **Canvas Management**: HTML5 Canvas

**Backend**:
- **API**: REST/GraphQL for saving/sharing
- **Database**: Store character configurations
- **File Export**: Generate STL files (3D printing format)
- **Image Capture**: Canvas 2D API for PNG export

### 3D Model Architecture

**Character Structure** (Parametric Modeling):
```
Character {
  body: {
    type: "humanoid", // humanoid, dragon, construct
    bodyType: "athletic", // slim, athletic, heavy
    height: 1.0 // scale multiplier
    pose: "standing", // standing, kneeling, sitting
  },
  head: {
    faceShape: "oval",
    eyeColor: "#0066ff",
    nosePath: "average",
    expression: "neutral"
  },
  armor: {
    chest: {
      type: "plate", // or leather, cloth, none
      material: "steel",
      color: "#8b8680",
      condition: "pristine"
    },
    arms: {...},
    legs: {...}
  },
  accessories: [
    {
      type: "weapon",
      subtype: "sword",
      model_id: "sword_longsword_01",
      position: "right_hand",
      scale: 1.0,
      color: "#888888"
    }
  ],
  customization: {
    skinColor: "#f4a460",
    hairColor: "#8b4513",
    scarColor: true,
    tattoos: [...]
  }
}
```

### Rendering Pipeline

**WebGL 3D Rendering**:
1. **Load Base Mesh**: 
   - Load humanoid base model (vertices, faces, normals)
   - Pre-created in Blender/Maya, imported as 3D file
   
2. **Apply Morphs** (Parametric Deformation):
   - Sliders for "body width", "leg length", etc.
   - Each slider blends between pre-created mesh shapes
   - GPU-side morphing = smooth blending
   
3. **Apply Materials** (Texturing):
   - Skin texture: photo-realistic skin with color adjustments
   - Armor textures: metal, leather, cloth patterns
   - Dynamic color overlays (user selected colors)
   
4. **Assemble Parts**:
   - Attach armor meshes at correct positions
   - Attach accessories (weapons, shields)
   - Ensure no clipping (meshes overlapping)
   - Position via 3D transforms (rotation, translation, scale)

5. **Camera & Lighting**:
   - Orbit camera: user can rotate 360°
   - 3-point lighting: key light, fill light, back light
   - Shadows: real-time shadow mapping
   - Material reflection: shiny metal vs. matte cloth

6. **Render to Screen**:
   - Draw frame at 60 FPS
   - WebGL context sends draw calls to GPU
   - GPU renders to framebuffer
   - Display in HTML5 canvas element

### Export Process

**STL Export** (for 3D printing):
```
User clicks "Export STL"
↓
JavaScript accesses Three.js scene
↓
For each visible mesh:
  1. Get vertex positions
  2. Get face indices
  3. Convert to STL format (ASCII or binary)
↓
Combine all meshes into single 3D model
↓
Apply pose/animation transformations:
  - If character in "kneeling" pose
  - Apply bone transformations to vertices
  - Export with deformed geometry
↓
Compress STL → ZIP file
↓
Download to user's computer
↓
User sends to 3D print service (Shapeways, etc.)
```

**Challenge**: 
- WebGL context buffers are cleared automatically
- Export code must force render update before capture
- `preserveDrawingBuffer: true` on context creation

**PNG Export** (screenshot):
1. Rotate character several degrees
2. Render frame
3. Capture canvas to DataURL
4. Save as PNG
5. Loop to create rotation sequence (GIF-like animation)

### Data Persistence

**Save Character to Cloud**:
```json
{
  "characterId": "char_heroforge_xyz",
  "userId": "user_abc",
  "name": "Sir Thrash Ironforge",
  "description": "A dwarf barbarian",
  "characterData": {
    "body": {...},
    "armor": {...},
    "accessories": [...]
  },
  "image": "base64_png_data",
  "createdAt": "2025-06-15T10:30:00Z",
  "updatedAt": "2026-06-21T14:22:00Z",
  "shared": true,
  "publicUrl": "heroforge.com/load_config=xyz123"
}
```

**Share Link**:
- Compress character config to URL parameters
- Public link: `heroforge.com/load_config=xyz123`
- Anyone can view, but only owner can edit
- No login required to view shared designs

---

## 2. IDLE/CLICKER GAMES (Cookie Clicker, Egg Inc.)

### What They Do
Minimal interaction games: click to earn currency, buy buildings that auto-produce, upgrade to increase production, prestige system to reset for multipliers.

### Core Mechanics

**Resource Flow**:
```
Click Event
↓
Earn 1 cookie
↓
CpS (Cookies per Second) from buildings adds to total
↓
User can spend cookies on:
  - Buildings (auto-producers)
  - Upgrades (multiply production)
  - Prestige (reset for permanent bonus)
↓
Buildings cost exponentially more:
  Building 1: 15 cookies
  Building 2: 100 cookies
  Building 3: 1,100 cookies
  Building 4: 12,000 cookies
  (exponential growth)
```

### Game State Data Structure

```json
{
  "gameState": {
    "cookies": 1250000,
    "cps": 50000, // cookies per second
    "clickPower": 1, // cookies per click
    "grandmasOwned": 25,
    "totalCookiesEarned": 5000000, // all-time stat
    "buildings": [
      {
        "buildingType": "grandma",
        "buildingId": 1,
        "owned": 25,
        "baseProduction": 1,
        "costBase": 15,
        "costCurrent": 3750, // 15 * 1.15^25
        "totalProduced": 2500000
      },
      {
        "buildingType": "farm",
        "buildingId": 2,
        "owned": 10,
        "baseProduction": 8,
        "costBase": 100,
        "costCurrent": 3098,
        "totalProduced": 800000
      }
    ],
    "upgrades": [
      {
        "upgradeId": "upgrade_grandma_better_house",
        "name": "Better Houses for Grandmas",
        "type": "building_multiplier",
        "targetBuilding": "grandma",
        "multiplier": 1.1, // 10% boost
        "purchased": true,
        "purchasedAt": "2026-06-15T10:00:00Z"
      }
    ],
    "goldenCookies": [
      {
        "id": "golden_1",
        "type": "multiplier", // or instant_cookies, combo
        "multiplier": 7.0,
        "duration": 77, // seconds
        "activatedAt": "2026-06-21T14:22:00Z"
      }
    ],
    "prestige": {
      "level": 3,
      "totalPrestigePower": 50, // permanent multiplier
      "prestigeEarned": 500
    },
    "achievements": [
      {
        "achievementId": "ach_first_click",
        "name": "Wake Up",
        "description": "Click a cookie",
        "unlocked": true,
        "unlockedAt": "2025-06-15T10:00:00Z"
      }
    ]
  }
}
```

### Save System

**Auto-save** (every 5 seconds):
1. Serialize entire `gameState` to JSON
2. Compress with zlib or gzip
3. Store in browser localStorage (limited to 5-10MB)
4. If localStorage full: use IndexedDB (larger capacity)

**Cloud Save** (optional, with account):
1. Upload compressed save to server
2. Server stores with userId + timestamp
3. Allow restore from cloud on different device
4. Multi-save support (multiple save slots)

### Production Calculation

**Per-frame update** (60 FPS = every 16.67 ms):
```javascript
function updateProduction() {
  // Calculate total CpS
  let totalCpS = 0;
  
  for (let building of buildings) {
    let buildingProduction = building.owned * building.baseProduction;
    
    // Apply upgrades that boost this building
    for (let upgrade of upgrades) {
      if (upgrade.targetBuilding == building.id && upgrade.purchased) {
        buildingProduction *= upgrade.multiplier;
      }
    }
    
    totalCpS += buildingProduction;
  }
  
  // Apply global multipliers (golden cookies, prestige)
  totalCpS *= (1 + prestige.level * 0.1);
  if (goldenCookieActive) {
    totalCpS *= goldenCookie.multiplier;
  }
  
  // Add to total cookies
  const deltaTime = 1 / 60; // seconds per frame
  cookies += (totalCpS * deltaTime);
  
  // Update display
  updateUI();
}
```

### Prestige System

**How it Works**:
1. User accumulates **Prestige Chips** (earned from total cookies ever earned)
   - Formula: `prestigeChips = sqrt(totalCookiesEarned) * 0.01`
   - 1M cookies earned = ~31.6 prestige
   - 100M cookies earned = ~316 prestige

2. User clicks "Ascend" → **Prestige Reset**:
   - Reset all buildings to 0
   - Reset all upgrades
   - Keep prestige chips (permanent bonus)
   - Gain multiplier: `1 + (prestigeChips * 0.01)` = 2x production

3. **Reason Players Do This**:
   - Early game extremely slow (need 1M cookies to unlock new building)
   - After prestige: production 2x faster
   - Gets easier with each reset
   - Encourages continued play

### Upgrades & Synergies

**Upgrade Tree**:
```
Grandma Upgrades:
├─ Better Houses for Grandmas (1.1x)
├─ Efficient Farming (1.15x)
├─ Generational Shift (1.2x)
└─ Retirement Fund (1.25x)

Building Synergies:
├─ Grandmas love Farms (Grandmas × Farms both get 1.5x)
├─ Farms love Grandmas (same 1.5x)
└─ Every building has similar synergies
```

**Complexity**: As you buy upgrades, keeping track of all multipliers is tricky. Game calculates:
```
finalProduction = baseProduction 
  * (1.1) // upgrade 1
  * (1.15) // upgrade 2
  * (1.5) // synergy with other buildings
  * (prestigeMultiplier)
  * (goldenCookieMultiplier)
```

---

## 3. CIVILIZATION VI - TURN-BASED STRATEGY

### What It Does
Turn-based strategy game: found civilizations, research technologies, build cities/armies, achieve victory (science, military, cultural, diplomatic, religious).

### Game Engine

**Civilization V/VI Engine: Firaxis LORE**
- **Name**: Low Overhead Rendering Engine
- **Graphics API**: DirectX 11 (Windows), Metal (Mac)
- **Design**: Originally built for DirectX 11, mapped back to DirectX 9
- **Key Innovation**: Tessellation support (GPU geometry generation)

### Map Architecture

**Hexagonal Grid System** (changed from Civ IV's square grid):
```
Hexagonal Tile Properties:
{
  tileId: "tile_x42_y35",
  coordinates: { x: 42, y: 35 },
  terrain: {
    type: "grassland", // plains, desert, tundra, snow, coast
    elevation: 1, // 0 (flat) to 3 (mountain)
    rivers: ["north", "east"], // which edges have rivers
    features: ["forest"], // forest, jungle, reefs, mountains
    resource: "wheat", // iron, coal, uranium, etc.
    improvementType: "farm", // farm, mine, plantation, pasture
    improvementComplete: true
  },
  ownership: {
    civId: "civ_egypt",
    districtType: "city_center", // or campus, holy_site, etc.
    building: "granary"
  },
  visibility: {
    explored: true,
    visible: true, // in player's field of view
    revealedBy: ["civ_egypt", "civ_greece"]
  },
  yieldProduction: {
    food: 2,
    production: 1,
    gold: 1,
    faith: 0,
    culture: 0,
    science: 0
  }
}
```

### City Simulation

**City Object**:
```json
{
  "cityId": "city_memphis",
  "civilizationId": "civ_egypt",
  "name": "Memphis",
  "tileCoordinates": { x: 50, y: 40 },
  "populationSize": 25,
  "populationGrowth": 2.5, // turns to next citizen
  "housing": 30, // max population before penalty
  "amenities": 4, // happiness/loyalty
  "loyalty": 95, // 0-100, low = rebellion risk
  "productionQueue": [
    {
      productionType": "unit",
      unitType": "warrior",
      progressCurrent": 60,
      progressTotal": 80
    }
  ],
  "buildings": [
    "granary",
    "monument",
    "barracks"
  ],
  "districts": [
    { "districtType": "holy_site", "adjacencyBonus": 1 }
  ],
  "religionPresence": {
    "egyptianPolytheism": 80, // % of population
    "hellenism": 20
  },
  "yields": {
    "food": 12, // resources per turn
    "production": 8,
    "gold": 5,
    "science": 4,
    "culture": 3,
    "faith": 2
  },
  "governorAssigned": "governor_reyna"
}
```

### Turn-Based Simulation

**Per-Turn Update**:
```
1. Player Input Phase
   - Player selects unit to move
   - Player builds structure/unit
   - Player researches technology
   
2. Yield Calculation
   - For each city:
     - Sum yields from terrain + buildings + districts
     - Apply governor bonuses
     - Apply policy cards (temporary modifiers)
     - Apply religion/trade route bonuses
   
3. Growth & Production
   - Pop growth: food accumulates
   - When food_accumulated > growth_threshold → +1 pop
   - Production queue: add production per turn
   - When production >= unit_cost → unit complete, spawn
   
4. Diplomacy & Religion
   - Holy site spreads religion to adjacent cities
   - Trade routes transfer gold/faith/science
   - Espionage operations happen
   - Diplomatic favor accumulated
   
5. AI Turn
   - For each AI civilization:
     - Evaluate state (military strength, victory progress)
     - Execute AI moves (move units, build, research)
     - Update diplomacy (trade, alliances, wars)
   
6. Victory Check
   - Is any civ winning? (science → space race complete?)
   - Are allies at war? → loyalty/amenity hit
   - Check win conditions
```

### Fog of War (Visibility)

**Visibility System**:
```
Player_Vision {
  explored: true,  // ever seen this tile?
  visible: true,   // can see right now?
  revealedBy: [
    "unit_xyz",     // specific unit seeing it
    "trade_route",  // trade routes grant vision
  ]
}

Each unit has:
- vision_range: 2 // tiles away it can see
- elevated: true  // mountains see further (3 range)

Calculation per turn:
For each player unit:
  For each tile within vision_range:
    If not blocked by terrain → mark as visible
    If ocean/mountain blocks → line of sight check
Set invisible tiles as "last known" (show old state)
```

### Rendering Pipeline

**LORE Rendering**:
1. **Geometry**: 
   - Hexagon mesh for each tile
   - Terrain meshes (mountains, forests, water)
   - Unit meshes (soldier, settler, scout, etc.)
   - District/building meshes
   
2. **Culling**:
   - Only render tiles in camera view
   - Units off-screen skipped
   - Large maps (100x100+ tiles): render only visible region

3. **Layer Rendering**:
   ```
   Layer 0: Terrain (grass, water, desert)
   Layer 1: Features (forest, mountain)
   Layer 2: Improvements (farm, mine)
   Layer 3: Districts & Buildings
   Layer 4: Units (with selection highlights)
   Layer 5: UI (health bars, icons)
   ```

4. **Draw Calls**: One per layer type
   - Batch geometry: combine all terrain into single mesh
   - Use texture atlas for varied appearances
   - ~20-50 draw calls per frame (efficient)

### Save File Format

**Serialization**:
```
Civ6SaveFile {
  gameVersion: "1.0.12",
  scenarioName: "standard",
  mapSize: "standard",
  difficulty: "immortal",
  players: [
    {
      civId: "civ_egypt",
      leaderName: "Cleopatra",
      difficulty: "immortal",
      cities: [...],
      units: [...],
      technologies: [...],
      civics: [...],
      religion: {...},
      diplomacy: {...}
    }
  ],
  globalState: {
    currentTurn: 150,
    year: "-1000 AD",
    victories: {
      science: 45, // % toward victory
      military: 20,
      cultural: 30,
      religious: 10
    }
  }
}
```

**File Size**: 1-50 MB depending on:
- Map size (larger maps = more tiles)
- Number of civilizations
- Game progress (more turns = more history)

### AI Behavior

**Civilization AI**:
- Evaluates: military strength, tech progress, victory path
- If weak militarily → focus on defensive units
- If leading in science → push space race
- If isolated → focus internal development
- If strong → aggressive expansion

---

## 4. SIDE-SCROLLING STRATEGY (Kingdom Simulator Hybrids)

### Example: Northgard

### What It Does
2D side-view base builder: manage resources, build structures, train units, defend against attacks and harsh winters.

### Game Architecture

**Map Grid**:
```
Each tile = 32x32 pixels
Supports placement of:
- Houses (increase population)
- Farms (food production)
- Barracks (military)
- Watchtower (defense)
- Walls (protection)

Grid movement:
- Units move tile-by-tile
- A* pathfinding around obstacles
- Collision detection between units/buildings
```

### Production & Resource Management

**Resource Types**:
```json
{
  "resources": {
    "food": 250,
    "wood": 150,
    "gold": 50,
    "population": 25,
    "happiness": 80 // 0-100
  },
  "production_per_turn": {
    "food": 15,
    "wood": 10,
    "gold": 3
  },
  "consumption_per_turn": {
    "food": 10,
    "happiness_penalty": -2 // if food deficit
  }
}
```

**Winter Mechanic** (unique to Northgard):
```
Winter {
  every: 4, // years
  duration: 2, // years
  effects: {
    food_production: 0, // farms produce nothing
    happiness_penalty: -15,
    unit_speed: 0.5, // units move slower
    building_time: 1.5 // buildings take 50% longer
  },
  challenge: Must store enough food to survive winter
}
```

### Unit Combat System

**Turn-Based Battles**:
1. Unit moves adjacent to enemy
2. Next turn: Click to attack
3. Damage = base_damage + weapon_bonus - armor
4. If HP → 0: unit dies
5. Morale affects combat power

**Formation System**:
- Ranged units: stand back, attack from distance
- Melee units: charge forward
- AI pathfinding tries to keep proper formation

---

## SUMMARY: ARCHITECTURE PATTERNS ACROSS GAMES

### Save System Patterns

| Game Type | Save Method | Storage | Size |
|-----------|-------------|---------|------|
| Clickers | Auto-save JSON | localStorage | 1-5 MB |
| Civ | Full serialization | Disk file | 10-50 MB |
| Strategy | Incremental | Cloud + local | 5-20 MB |
| 3D Creators | Part-based config | Cloud | <1 MB |

### Rendering Patterns

| Game Type | Renderer | Technology | Performance |
|-----------|----------|-----------|-------------|
| 3D Creator | WebGL | Three.js | 60 FPS (browser) |
| Civ VI | DirectX 11 | Custom LORE | 30-60 FPS |
| Strategy | WebGL/Canvas | Custom | 30-60 FPS |
| Clickers | Canvas 2D | HTML5 | 60 FPS |

### Data Patterns

| Game Type | Primary Storage | Update Rate | Query Pattern |
|-----------|-----------------|------------|--------------|
| Clickers | In-memory + localStorage | Every frame | Read-heavy |
| Civ | Relational (save file) | Per turn | Random access |
| Online Strategy | Cloud DB | Event-driven | Event streaming |
| Creator | Cloud (user saves) | On-demand | User-initiated |

