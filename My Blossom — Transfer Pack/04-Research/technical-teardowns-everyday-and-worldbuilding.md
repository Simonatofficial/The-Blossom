# Deep Technical Analysis: Everyday Apps & Entertainment/World-Building Apps
## How They Work, What They're Built From, and How They're Built

---

## PART 1: EVERYDAY UTILITY APPS

---

## 1. GOOGLE CALENDAR

### What It Does
Calendar app for scheduling events, managing time zones, sharing calendars, setting reminders, and integrating with other services.

### Technology Stack
- **Backend**: Google Cloud infrastructure (distributed across multiple data centers)
- **API Type**: RESTful API (Google Calendar API v3)
- **Frontend**: Web-based (likely React or similar), Mobile (iOS/Android native)
- **Database**: Google Cloud's proprietary distributed database systems
- **Real-time Sync**: WebSocket connections for push notifications
- **CalDAV Support**: Calendar Data Access Protocol for interoperability

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         Google Calendar API v3 (REST)               │
│   HTTP endpoints at googleapis.com/calendar/v3       │
└──────────────┬──────────────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
    ┌───▼──┐      ┌───▼──┐
    │ iOS  │      │Android│     Web Browser
    │ App  │      │ App   │     (React/JS)
    │      │      │       │
    └──────┘      └───────┘
        │             │           │
        └─────────────┼───────────┘
                      │
            ┌─────────▼──────────┐
            │  Google Cloud      │
            │  Load Balancer     │
            └─────────┬──────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
    ┌───▼──┐      ┌───▼──┐     ┌───▼──┐
    │ App  │      │ App  │     │ App  │
    │Server│      │Server│     │Server│ (Multiple zones)
    │ 1    │      │ 2    │     │ 3    │
    └──────┘      └──────┘     └──────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
            ┌─────────▼──────────┐
            │  Google Cloud SQL  │
            │  (Spanner, etc)    │
            │  Distributed DB    │
            └────────────────────┘
```

### Core Concepts & Data Structures

**Event Object** (simplified):
```json
{
  "id": "unique_event_id_xyz",
  "summary": "Team Meeting",
  "description": "Q4 Planning",
  "start": {
    "dateTime": "2026-06-21T14:00:00",
    "timeZone": "America/Los_Angeles"
  },
  "end": {
    "dateTime": "2026-06-21T15:00:00",
    "timeZone": "America/Los_Angeles"
  },
  "attendees": [
    { "email": "user1@example.com", "responseStatus": "accepted" },
    { "email": "user2@example.com", "responseStatus": "tentative" }
  ],
  "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"],
  "reminders": [
    { "method": "email", "minutes": 1440 },
    { "method": "notification", "minutes": 15 }
  ],
  "organizer": { "email": "creator@example.com", "displayName": "Alice" },
  "created": "2026-01-15T10:30:00Z",
  "updated": "2026-06-15T14:22:00Z"
}
```

**Calendar Object**:
```json
{
  "id": "primary|secondary",
  "summary": "Personal|Work|Holidays",
  "timeZone": "America/Los_Angeles",
  "backgroundColor": "#9fe1e7",
  "foregroundColor": "#000000",
  "selected": true,
  "accessRole": "owner|writer|reader"
}
```

### How It Works: Event Creation Flow

1. **User Input**: Type event details in web/mobile interface
2. **Client-side Validation**: Check for conflicts, format validation
3. **API Request**: POST to `https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
   - Include OAuth 2.0 access token for authentication
   - Send event JSON with all details
4. **Server-side Processing**:
   - Validate event data (time zones, attendees exist, no conflicts)
   - Generate unique event ID
   - Store in distributed database
   - Process attendee invites (send emails/notifications)
5. **Recurrence Expansion**: If event is recurring:
   - Parse RRULE (RFC 5545 standard)
   - Calculate all instances within reasonable range
   - Store expanded instances or generate on-the-fly
6. **Push Notification**: WebSocket push to all connected clients
   - Other devices get real-time sync
   - Calendar re-renders new event
7. **Response to Client**: Return created event with status 200

### Real-time Sync Mechanism

**Push Notifications**:
- Google Calendar uses WebSocket connections for real-time updates
- When a user updates an event, a notification is pushed to all their devices
- Uses "watch" endpoint: `POST /calendars/{calendarId}/watch`
- Watches are registered with a unique "address" (webhook URL)
- When changes occur, Google sends notification to webhook

**Conflict Detection**:
- When retrieving free/busy info: `freebusy.query()`
- Checks all events in time range across all calendars
- Returns busy/free blocks for scheduling

### Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/calendars/{id}/events` | GET | List all events in a calendar |
| `/calendars/{id}/events` | POST | Create new event |
| `/calendars/{id}/events/{eventId}` | PATCH | Update event |
| `/calendars/{id}/events/{eventId}` | DELETE | Delete event |
| `/calendars/{id}/events/quickAdd` | POST | Natural language event creation |
| `/calendars/{id}/events/{eventId}/instances` | GET | Get all instances of recurring event |
| `/freebusy` | POST | Check free/busy status |
| `/calendars/{id}/watch` | POST | Subscribe to real-time updates |

### Storage Considerations
- **Calendar Metadata**: Quick access (frequently referenced)
- **Events**: Distributed across time ranges (queries by date range)
- **Recurrence Rules**: Stored once, expanded on-the-fly
- **Attendee Responses**: Track acceptance/decline/tentative status
- **Access Control Lists (ACLs)**: Who can view/edit/share

---

## 2. APPLE NOTES & REMINDERS

### What They Do
- **Notes**: Rich text note-taking with images, links, tables, collaboration
- **Reminders**: Task/to-do list with due dates, subtasks, smart lists

### Technology Stack
- **Backend**: Apple iCloud (private cloud infrastructure)
- **Encryption**: End-to-end encryption (CloudKit architecture)
- **Sync**: CloudKit framework (Apple's proprietary database service)
- **Frontend**: SwiftUI (iOS/macOS), Objective-C
- **Data Format**: Proprietary Apple binary format (not JSON/plaintext)
- **Conflict Resolution**: Last-write-wins with CRDT-like principles

### Architecture Overview

```
┌──────────────────────────────────────┐
│  User's Apple Devices (iPhone, Mac,  │
│  iPad, Apple Watch, Vision Pro)      │
└──────────────────┬───────────────────┘
                   │
            ┌──────▼──────┐
            │  CloudKit   │
            │  Framework  │  (Apple's proprietary sync backend)
            │             │
            │ - Encryption│
            │ - Conflict  │
            │   Resolution│
            │ - Version   │
            │   Control   │
            └──────┬──────┘
                   │
        ┌──────────┼──────────┐
        │                     │
    ┌───▼──┐             ┌───▼──┐
    │iCloud│             │iCloud│  (Multiple geographic regions)
    │ Data │             │ Data │
    │Center│             │Center│
    │ 1    │             │ 2    │
    └──────┘             └──────┘
        │                     │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  Apple's Master     │
        │  Database (ACID)    │
        └─────────────────────┘
```

### Data Structures

**Notes**:
```
Note Container {
  uuid: String (unique identifier)
  title: String
  body: RichText (custom binary format)
  attachments: [Attachment]
  lastModified: Timestamp
  created: Timestamp
  version: Int (for conflict resolution)
  collaborators: [Collaborator]
  accessLevel: Enum (owner, editor, viewer)
  isFolderPin: Bool
  folder: FolderReference
}

RichText {
  - Formatted text blocks
  - Embedded images (as blobs)
  - Checklists (structured data)
  - Tables (grid structure)
  - Links (URL references)
  - Mentions (@username references)
}

Attachment {
  id: UUID
  mimeType: String
  size: Int
  data: BinaryBlob
  metadata: {width, height, duration, etc}
}
```

**Reminders**:
```
Reminder {
  id: UUID
  title: String
  dueDate: DateTime (optional)
  dueTime: Time (optional)
  location: Location (optional)
  priority: Int (0-3, or none)
  completed: Bool
  completedDate: DateTime
  subtasks: [Subtask]
  notes: String
  url: URL (optional)
  flagged: Bool
  tags: [String]
  list: ReminderList
  recurrence: RecurrenceRule
  alarms: [Alarm]
  updatedAt: Timestamp
  version: Int
}

ReminderList {
  id: UUID
  name: String
  color: Color
  type: Enum (normal, smart)
  smartCriteria: SmartListRule (if smart)
  isShared: Bool
  sharedWith: [User]
  order: Int
}

SmartListRule {
  - Conditions: dueToday, dueTomorrow, allIncomplete, allFlagged, etc.
  - Combined with AND/OR logic
  - System maintains virtual list based on rules
}
```

### Sync Mechanism (CloudKit)

**Change Propagation**:
1. User edits note on iPhone
2. Local Changes recorded (offline-capable)
3. When network available: CloudKit framework queues changes
4. Device uploads changes to CloudKit servers
5. CloudKit applies changes to master database
6. Change notification sent to all other devices
7. Mac/iPad receive notification via push
8. Local notes updated with changes
9. UI refreshes to show latest version

**Conflict Resolution**:
- **Last-Write-Wins**: If two devices edit simultaneously, later timestamp wins
- **Field-level Merging**: Different fields can have different "winners"
- **User Notification**: If edits conflict, user may be prompted
- **Version Tracking**: Each record has version number for conflict detection

### Encryption Model
- **End-to-End**: Apple doesn't have keys to decrypt
- **Device Key**: Each device has local encryption key
- **iCloud Keychain**: Master keys stored encrypted in iCloud
- **Two-Factor Auth**: Required for account security

### SmartList Implementation
Smart lists like "Today," "Upcoming," "Flagged" don't store separate data.

Instead:
- Smart list rule evaluated at query time
- Query all reminders in user's lists
- Filter by rule: `dueDate == today && !completed`
- Sort by priority, then due time
- Return filtered results

This is efficient because:
- No data duplication
- Rules always current (no stale data)
- Less sync overhead
- Single source of truth

---

## 3. SHOPPING LIST APPS (Bring, Out of Milk, etc.)

### Example: Bring Shopping List App

### Technology Stack
- **Frontend**: React Native (iOS/Android cross-platform)
- **Backend**: Node.js/Express or similar REST API
- **Database**: PostgreSQL or MongoDB
- **Real-time**: Socket.io or Pusher for live list updates
- **Cloud Storage**: AWS S3 for images
- **Authentication**: OAuth 2.0, JWT tokens

### How It Works: Adding Item to Shared List

**Data Structure**:
```json
{
  "listId": "list_abc123",
  "items": [
    {
      "id": "item_xyz789",
      "name": "Milk",
      "quantity": "2",
      "unit": "liters",
      "category": "Dairy",
      "status": "unchecked",
      "createdBy": "user_alice",
      "createdAt": "2026-06-21T14:30:00Z",
      "checkedAt": null,
      "checkedBy": null,
      "imageUrl": null,
      "price": null
    }
  ],
  "members": [
    {
      "userId": "user_alice",
      "role": "owner",
      "addedAt": "2026-01-01T00:00:00Z"
    },
    {
      "userId": "user_bob",
      "role": "member",
      "addedAt": "2026-03-15T10:20:00Z"
    }
  ],
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-06-21T14:30:00Z"
}
```

**Add Item Flow**:
1. User types "Milk, 2 liters"
2. App parses: `name="Milk"`, `quantity="2"`, `unit="liters"`
3. App auto-categorizes to "Dairy" (ML model trained on user history)
4. POST `/api/lists/{listId}/items` with JWT token
5. Server validates: user is list member, list exists
6. Server creates item with unique ID
7. Item saved to database with timestamps
8. Server emits WebSocket event: `itemAdded` to all list members
9. Other users' apps receive push and update UI in real-time
10. Confirmation sent back to originating user

**Checking Items Off**:
- Instead of deletion, items marked `checked: true`, `checkedAt: timestamp`
- Allows undo, history tracking
- Some apps auto-hide checked items
- Swiping/button toggles `checked` boolean

**Sharing Mechanism**:
- Generate share token (short alphanumeric code, e.g., "ABC123")
- Other user enters code to join list
- Server validates token hasn't expired
- Add user to list's `members` array with `role: "member"`
- All devices sync and see shared list

---

## 4. FITNESS APPS (Strava)

### Technology Stack
- **Frontend**: React/TypeScript (web), native iOS/Android
- **Backend**: Scala, Java, or Node.js microservices
- **Map Rendering**: Mapbox GL or similar
- **Database**: PostgreSQL (structured), Redis (caching), S3 (GPX files)
- **GPS Processing**: Specialized geolocation libraries
- **Real-time**: WebSocket for leaderboard updates
- **Analytics**: Kafka event streaming, Elasticsearch

### Data Structures

**Activity Object**:
```json
{
  "id": "activity_123456",
  "userId": "user_strava_789",
  "activityType": "run", // run, ride, swim, hike, etc
  "name": "Morning 5K",
  "startDate": "2026-06-21T06:00:00Z",
  "sportType": "TrailRun",
  "distance": 5000.42, // meters
  "movingTime": 1800, // seconds
  "elapsedTime": 1950,
  "totalElevationGain": 125.5, // meters
  "averageSpeed": 2.78, // m/s
  "maxSpeed": 3.45,
  "averageHeartrate": 162,
  "maxHeartrate": 175,
  "polyline": "encoded_polyline_string", // compressed GPS path
  "startLatlng": [37.7749, -122.4194], // San Francisco
  "endLatlng": [37.7850, -122.4100],
  "locationCity": "San Francisco",
  "locationState": "California",
  "manual": false,
  "trainer": false,
  "commute": false,
  "private": false,
  "flagged": false,
  "visibility": "everyone", // private, followers_only, everyone
  "gearId": "bike_456",
  "calories": 520.5,
  "description": "Beautiful morning run through the Presidio",
  "deviceName": "Apple Watch Series 7",
  "embedToken": "embed_token_xyz", // for sharing embedded activities
  "photos": [
    {
      "id": "photo_1",
      "resourceState": 2,
      "ref": "activity_123456/photo_1",
      "uid": "photo_uid",
      "captureType": 2,
      "uploadedAt": "2026-06-21T07:00:00Z",
      "createdAt": "2026-06-21T06:45:00Z",
      "sizes": {
        "thumbnail": "https://...",
        "display": "https://..."
      }
    }
  ],
  "kudosCount": 24,
  "commentCount": 3,
  "athleteCount": 1,
  "map": {
    "id": "map_123",
    "summaryPolyline": "encoded_polyline",
    "resourceState": 2
  },
  "segment_efforts": [
    {
      "id": "seg_effort_001",
      "segmentId": "seg_789",
      "segmentName": "Golden Gate Bridge",
      "elapsedTime": 120,
      "movingTime": 119,
      "startIndex": 10,
      "endIndex": 50,
      "averageSpeed": 3.2,
      "maxSpeed": 4.1,
      "pr_rank": 5, // personal best rank on this segment
      "achievements": []
    }
  ],
  "splits_metric": [
    { "distance": 1000, "elapsedTime": 360, "elevationGain": 25, "movingTime": 350, "split": 1 },
    { "distance": 1000, "elapsedTime": 358, "elevationTime": 24, "movingTime": 348, "split": 2 }
  ],
  "workout_type": 1, // 0=easy, 1=tempo, 2=threshold, 3=repeat
  "trainer": false,
  "commute": false,
  "manual": false,
  "private": false,
  "flagged": false,
  "createdAt": "2026-06-21T06:00:00Z",
  "updatedAt": "2026-06-21T07:15:00Z"
}
```

**Segment (Virtual Route)** - crucial for Strava's competitive model:
```json
{
  "id": "segment_789",
  "name": "Golden Gate Bridge",
  "activityType": "run",
  "distance": 1300.5,
  "averageGrade": 3.2,
  "maxGrade": 8.5,
  "elevationHigh": 150.2,
  "elevationLow": 12.4,
  "startLatlng": [37.8299, -122.4783],
  "endLatlng": [37.8299, -122.4579],
  "climbCategory": 1, // 0=not categorized, 1=4th, 2=3rd, 3=2nd, 4=1st, 5=HC
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-06-15T12:00:00Z",
  "effortCount": 5000, // how many people have done this segment
  "athleteCount": 2500, // unique athletes
  "starred": true, // user starred it
  "private": false
}
```

### How GPS Data is Processed

**Raw GPS Stream**:
```
Device → GPS points every 1 second:
{lat: 37.7749, lng: -122.4194, alt: 5, time: t0}
{lat: 37.7750, lng: -122.4193, alt: 6, time: t0+1s}
{lat: 37.7751, lng: -122.4192, alt: 7, time: t0+2s}
...
```

**Processing Pipeline**:
1. **Data Cleanup**: Remove outliers, smooth GPS noise
2. **Elevation Smoothing**: Use elevation database to correct barometric data
3. **Speed Calculation**: Distance between consecutive points / time delta
4. **Pause Detection**: When speed near zero for X seconds = pause
5. **Polyline Encoding**: Compress GPS points using Google's polyline encoding algorithm
   - Converts GPS path to compre...ssed string: `_pneFxbXjVkE`
6. **Segment Matching**: Check if activity passes through known segments
   - Compare GPS points against segment coordinates
   - If activity covers segment start→end, create segment effort
7. **Split Calculation**: Divide activity into equal-distance splits (1km, 1mi)
   - Calculate stats per split for pacing insight

**Segment Leaderboard Calculation**:
- When user completes segment, record their time
- Query all past efforts on that segment
- Rank by fastest time
- Check if it's a new personal record (PR)
- Update crown (KOM = King of the Mountain, if #1)

### Real-time Leaderboard Updates

**Flow**:
1. User finishes run with Strava
2. Activity uploaded to Strava servers
3. Server processes GPS data, detects segment efforts
4. For each segment effort:
   - Get all other efforts in last 24 hours
   - Recalculate leaderboard top 10
   - If user now in top 10, emit WebSocket event
5. Other users following that segment get real-time notification
6. Leaderboard refreshes on their devices

### Data Privacy & Privacy Controls
- Private activities excluded from leaderboards
- Followers-only activities only visible to followers
- Can hide home/work location (privacy zones)
- Activities can be flagged for removal

---

## 5. NUTRITION TRACKING (MyFitnessPal)

### Technology Stack
- **Frontend**: React Native (cross-platform)
- **Backend**: Java/Spring Boot microservices
- **Database**: MySQL/PostgreSQL (relational for structured data), Elasticsearch (food search)
- **Barcode Recognition**: Computer vision (OpenCV or TensorFlow)
- **Integrations**: Wearable API connections (Fitbit, Apple Watch, Garmin)
- **Analytics**: Google Analytics, internal event tracking

### Data Structure

**Food Database Entry**:
```json
{
  "foodId": 12345,
  "name": "Chicken Breast, cooked",
  "brand": null,
  "servingSize": "100",
  "servingSizeUnit": "g",
  "calories": 165,
  "protein": 31,
  "carbs": 0,
  "fat": 3.6,
  "fiber": 0,
  "sugar": 0,
  "sodium": 74,
  "cholesterol": 85,
  "saturatedFat": 1.0,
  "transFat": 0,
  "polyunsaturatedFat": 0.9,
  "monounsaturatedFat": 1.0,
  "potassium": 366,
  "vitaminA": 0,
  "vitaminC": 0,
  "calcium": 13,
  "iron": 1.0,
  "servings": 1,
  "ndb": "05062", // USDA FoodData Central ID
  "source": "usda", // or "user_created"
  "verified": true,
  "barcode": "01234567890123"
}
```

**User Food Log Entry**:
```json
{
  "entryId": "entry_xyz789",
  "userId": "user_mfp_456",
  "foodId": 12345,
  "servings": 1.5,
  "servingSize": "100g",
  "mealType": "lunch", // breakfast, lunch, dinner, snack
  "date": "2026-06-21",
  "time": "12:30:00",
  "calories": 247.5,
  "macros": {
    "protein": 46.5,
    "carbs": 0,
    "fat": 5.4
  },
  "notes": "Grilled with lemon",
  "createdAt": "2026-06-21T12:35:00Z",
  "updatedAt": "2026-06-21T12:35:00Z"
}
```

**Daily Nutrition Summary**:
```json
{
  "userId": "user_mfp_456",
  "date": "2026-06-21",
  "totalCalories": 2150,
  "goalCalories": 2000,
  "caloriesDifference": 150,
  "macros": {
    "protein": { "value": 125, "goal": 150, "unit": "g" },
    "carbs": { "value": 280, "goal": 225, "unit": "g" },
    "fat": { "value": 65, "goal": 65, "unit": "g" }
  },
  "micronutrients": {
    "sodium": { "value": 2500, "goal": 2300 },
    "fiber": { "value": 25, "goal": 25 },
    "sugar": { "value": 35, "goal": 50 }
  },
  "water": "8", // glasses
  "exercise": [
    { "activityId": "ex_1", "calories": 500 }
  ],
  "net_calories": 1650, // calories - exercise
  "weight": 75.2 // kg, if logged today
}
```

### Barcode Scanning Flow

1. User taps camera icon
2. App accesses camera
3. **Computer Vision Processing**:
   - Frame captured
   - TensorFlow model detects barcode region
   - Barcode recognition (EAN-13, UPC-A, etc.) decodes barcode
   - Returns numeric code: "01234567890123"
4. **Database Lookup**:
   - Query food database: WHERE barcode = "01234567890123"
   - If found: return food data instantly
   - If not found: show user search interface
5. **Nutrition Data Populated**:
   - Macro/micronutrient values auto-filled
   - User only needs to enter quantity
   - Much faster than manual entry

### Integration with Wearables

**API Flow**:
1. User connects Fitbit/Apple Watch via OAuth
2. MFP stores access token securely
3. Daily sync job (runs at night):
   - Query Fitbit API for daily metrics (steps, heart rate, calories burned)
   - Pull calorie burn estimate
   - Update user's food log with exercise calories
   - Recalculate net calories
4. User sees: "Exercise Burned: 500 cal"
5. Net daily calorie goal adjusts accordingly

### Search Algorithm

**Full-text Search** (food database has 14M+ entries):
- User types "chicken"
- Elasticsearch indexed search returns top results:
  - "Chicken Breast, cooked"
  - "Chicken Breast, raw"
  - "Chicken Thigh, cooked"
  - "Grilled Chicken (brand X)"
- Uses BM25 ranking algorithm
- Weights: name match > brand match > description

### Nutrition Calculation

For each meal logged:
```
total_calories = food.calories * user_entered_servings
protein_g = food.protein * user_entered_servings
carbs_g = food.carbs * user_entered_servings
fat_g = food.fat * user_entered_servings

daily_totals = SUM(all meals that day)
vs_goal = daily_totals - user_daily_goal
```

---

## 6. EDUCATIONAL APPS (Google Classroom, Canvas)

### Technology Stack (Google Classroom Example)
- **Frontend**: React (web), React Native (mobile)
- **Backend**: Google Cloud App Engine, Cloud Functions
- **Database**: Google Cloud Datastore (NoSQL), Cloud SQL (relational)
- **File Storage**: Google Cloud Storage (Google Drive integration)
- **Real-time**: Pub/Sub, Firebase Realtime Database for notifications
- **Authentication**: Google OAuth 2.0

### Data Structures

**Classroom/Course**:
```json
{
  "id": "classroom_123",
  "name": "AP Biology 2026",
  "description": "Study of living organisms",
  "section": "Period 3",
  "courseState": "ACTIVE", // PROVISIONED, ACTIVE, ARCHIVED, DELETED
  "ownerId": "teacher_456",
  "creationTime": "2025-08-15T08:00:00Z",
  "updateTime": "2026-06-21T10:30:00Z",
  "enrollmentCode": "xyz9abc",
  "alternateLink": "https://classroom.google.com/c/xyz",
  "teacherFolder": { "id": "folder_teacher_123" },
  "gradeBookSettings": {
    "calculationMethod": "TOTAL_POINTS", // or WEIGHTED_CATEGORIES
    "displayBehavior": "SHOW_OVERALL_GRADE"
  },
  "teachers": ["teacher_456"],
  "students": ["student_001", "student_002", "student_003"],
  "guardians": ["parent_001"],
  "courseMaterialSets": [] // optional pre-loaded content
}
```

**Assignment**:
```json
{
  "id": "assignment_789",
  "classroomId": "classroom_123",
  "title": "Chapter 5 Essay: Cell Mitosis",
  "description": "Write a 2-page essay...",
  "state": "PUBLISHED", // DRAFT, PUBLISHED, DELETED
  "alternateLink": "https://classroom.google.com/assignment/...",
  "creationTime": "2026-05-01T14:00:00Z",
  "updateTime": "2026-06-21T14:00:00Z",
  "dueDate": { "year": 2026, "month": 6, "day": 28 },
  "dueTime": { "hours": 23, "minutes": 59 },
  "maxPoints": 100,
  "workType": "ASSIGNMENT", // ASSIGNMENT, QUESTION, MATERIAL
  "materials": [
    {
      "driveFile": {
        "id": "file_xyz",
        "title": "Mitosis_Worksheet.pdf",
        "alternateLink": "https://docs.google.com/..."
      }
    }
  ],
  "assigneeMode": "ALL_STUDENTS", // INDIVIDUAL_STUDENTS
  "submissionModificationMode": "MODIFIABLE_UNTIL_TURNED_IN",
  "creatorUserId": "teacher_456",
  "associatedWithDeveloper": false,
  "topicId": "topic_mitosis"
}
```

**Student Submission**:
```json
{
  "id": "submission_456",
  "courseId": "classroom_123",
  "assignmentId": "assignment_789",
  "userId": "student_001",
  "creationTime": "2026-06-22T10:00:00Z",
  "updateTime": "2026-06-22T11:45:00Z",
  "state": "TURNED_IN", // CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT
  "late": false,
  "draftGrade": null,
  "assignedGrade": null,
  "attachments": [
    {
      "studentSubmission": {
        "attachmentId": "attach_123",
        "submissionHistory": {
          "submissionTime": "2026-06-22T10:30:00Z"
        }
      },
      "driveFile": {
        "id": "student_essay_doc",
        "title": "Essay_Final_Draft.docx",
        "alternateLink": "https://docs.google.com/..."
      }
    }
  ],
  "associatedWithDeveloper": false
}
```

### Assignment Submission Flow

1. **Student Views Assignment**:
   - GET `/classrooms/{id}/assignments/{id}`
   - Server returns assignment metadata + materials
   - Student reads instructions, views rubric

2. **Student Submits**:
   - Choose submission method:
     - Attach file (Google Drive)
     - Write answer (text box)
     - Paste link
     - Google Form response
   - POST `/courseWork/{id}/studentSubmissions` with attachment IDs
   - Server validates student is enrolled
   - Marks submission state as "TURNED_IN"
   - Records submission timestamp

3. **Teacher Grades**:
   - GET all submissions for assignment
   - For each student's submission:
     - View materials (open Google Doc, see PDF, etc.)
     - Add comments (inline and overall)
     - Assign grade (numeric or rubric-based)
   - PATCH submission with grade: `{"assignedGrade": 92}`
   - Server calculates impact on class average
   - Student notification sent

4. **Gradebook Calculation**:
   ```
   category_grade = AVERAGE(all assignments in category)
   weighted_grade = (category_grade_1 * weight_1) + (category_grade_2 * weight_2) + ...
   overall_grade = weighted_grade or total_points / max_points
   ```

### Real-time Features
- Notifications via Firebase Cloud Messaging
- When teacher posts announcement: all students get push
- When teacher grades: student gets notification
- Live Classroom Stream: new posts appear in real-time

---

## PART 2: ENTERTAINMENT & WORLD-BUILDING APPS

---

## 1. D&D BEYOND

### What It Does
Official digital character sheet builder, spell/item compendium, campaign manager for D&D 5E and 2024 ruleset.

### Architecture Evolution
- **Original (2015-2022)**: "Cobbled together as a demo" - monolithic codebase
- **Current**: Undergoing complete microservices rebuild (started 2018, ongoing)
- **Issue**: Hard-coded functionality made adding features difficult

### Technology Stack

**Current (Post-Rebuild)**:
- **Frontend**: React or Vue.js (web), React Native (mobile) 
- **Backend**: Microservices (likely Node.js, Java, or Go)
- **Database**: PostgreSQL (primary), Redis (caching), Elasticsearch (spell/item search)
- **Rules Engine**: Custom D&D 5E rules interpreter (complex business logic)
- **File Storage**: S3 for character images, campaign images
- **Real-time**: WebSocket for campaign gameplay
- **Authentication**: JWT tokens

### Character Sheet Data Structure

**Simplified Character Object**:
```json
{
  "characterId": "char_abc123",
  "userId": "user_dnd_456",
  "campaignId": "campaign_789",
  "name": "Thrash Ironforge",
  "class": "Barbarian",
  "level": 5,
  "experience": 6500,
  "race": "Half-Orc",
  "alignment": "Chaotic Neutral",
  "backgroundId": "soldier",
  "hitPoints": {
    "current": 52,
    "maximum": 52,
    "temporary": 0
  },
  "armorClass": 16,
  "speed": 30, // feet per round
  "abilityScores": {
    "strength": { "value": 18, "modifier": 4 },
    "dexterity": { "value": 12, "modifier": 1 },
    "constitution": { "value": 16, "modifier": 3 },
    "intelligence": { "value": 8, "modifier": -1 },
    "wisdom": { "value": 13, "modifier": 1 },
    "charisma": { "value": 10, "modifier": 0 }
  },
  "savingThrows": {
    "strength": { "value": 4, "proficiency": true },
    "dexterity": { "value": 1 },
    "constitution": { "value": 3 }
  },
  "skills": {
    "acrobatics": { "value": 1 },
    "animalHandling": { "value": 1 },
    "arcana": { "value": -1 },
    "athletics": { "value": 6, "proficiency": true },
    "deception": { "value": 0 }
  },
  "subclass": {
    "name": "Path of the Berserker",
    "features": ["Frenzy", "Mindless Rage"]
  },
  "inventory": [
    {
      "itemId": "item_greataxe_001",
      "name": "Greataxe",
      "quantity": 1,
      "equipped": true,
      "weight": 7,
      "rarity": "Common",
      "description": "1d12 slashing",
      "damage": {
        "diceCount": 1,
        "diceSize": 12,
        "type": "slashing",
        "modifier": 4
      }
    },
    {
      "itemId": "item_chain_mail",
      "name": "Chain Mail",
      "quantity": 1,
      "equipped": true,
      "armorClass": 16,
      "weight": 55,
      "type": "armor"
    }
  ],
  "spells": [], // Barbarians don't cast spells
  "classFeatures": [
    { "name": "Rage", "description": "...", "chargesPerDay": 4, "chargesRemaining": 2 },
    { "name": "Reckless Attack", "description": "..." },
    { "name": "Danger Sense", "description": "..." }
  ],
  "proficiencies": {
    "weaponTypes": ["Simple", "Martial"],
    "armorTypes": ["Light", "Medium", "Shield"],
    "languages": ["Common", "Orc"],
    "tools": ["Dice Set"]
  },
  "traits": {
    "personalityTraits": "Quiet and introspective",
    "ideals": "Live free or die",
    "bonds": "Sworn to avenge fallen clan",
    "flaws": "Struggles with rage"
  },
  "deathSaves": {
    "successes": 0,
    "failures": 0
  },
  "inspiration": true,
  "proficiencyBonus": 3,
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2026-06-21T14:22:00Z"
}
```

### How Character Building Works

**Ability Score Calculation**:
1. Choose generation method:
   - Standard Array: [15, 14, 13, 12, 10, 8]
   - Roll 4d6 drop lowest (6 times)
   - Point Buy: 27 points distributed
2. Apply racial bonuses: Half-Orc +2 Str, +1 Con
3. Apply feats/ASI (Ability Score Improvement) at levels 4, 8, 12, etc.
4. Calculate modifiers: `(ability_score - 10) / 2` (rounded down)
5. Calculate derived stats:
   - **Proficiency Bonus**: `2 + (level - 1) / 4`
   - **AC**: Base (from armor or 10 + dex mod) + DEX modifier
   - **Initiative**: DEX modifier
   - **Skills**: (ability modifier) + (proficiency bonus if trained)

**Spell Calculation** (for spellcasters):
```
cantrips_known = class_table[level].cantrips
spells_known = class_table[level].spells_known
spell_slots_per_level = {
  1: class_table[level].slot_1st,
  2: class_table[level].slot_2nd,
  ...
}
spell_save_dc = 8 + proficiency_bonus + spellcasting_ability_modifier
spell_attack_bonus = proficiency_bonus + spellcasting_ability_modifier
```

### Rules Engine Complexity

D&D Beyond must encode:
- 300+ spells with unique mechanics
- 100+ items with special properties
- Hundreds of class features with conditions
- Feat interactions and stacking rules
- Concentration rules (only 1 concentration spell active)
- Multiclassing rules (complex level calculations)
- Subclass interactions

**Rules Interpreter Flow**:
1. User performs action (attack, cast spell)
2. System retrieves all relevant modifiers:
   - Base stat
   - Equipment bonuses
   - Active spells/buffs
   - Conditions (prone, invisible, etc.)
3. Apply all modifiers in correct order
4. Calculate result
5. Check for conflicts/restrictions
6. Validate against rules database
7. Update character state

### Campaign Management

**Campaign Object**:
```json
{
  "campaignId": "campaign_789",
  "name": "Curse of Strahd",
  "description": "A gothic horror campaign",
  "dungeonMasterId": "user_dm_123",
  "players": ["user_player_1", "user_player_2"],
  "characters": ["char_abc123", "char_xyz456"],
  "createdAt": "2025-06-01T00:00:00Z",
  "sessions": [
    {
      "sessionNumber": 1,
      "date": "2025-06-15T19:00:00Z",
      "summary": "Party arrived at castle...",
      "combatLog": [...],
      "notes": "..."
    }
  ],
  "maps": [...],
  "npcs": [...],
  "loot": [...]
}
```

**Real-time Gameplay** (via WebSocket):
1. DM rolls dice: `POST /campaigns/{id}/rolls`
2. Server broadcasts to all players in campaign
3. Players see result in real-time: "DM rolled 18 for Initiative"
4. Turn order calculated, sent to all players
5. Current player's turn indicated
6. Player makes action, DM validates
7. Character sheet updated, all players see changes

### Rules Database (the hard part)

D&D Beyond maintains massive database:
```
Spells Table:
- 300+ spells
- Each with: level, school, components, duration, range, description, damage dice, saving throws, etc.

Items Table:
- Weapons: damage dice, properties (finesse, heavy, etc.)
- Armor: AC calculation rules
- Magical Items: special effects and mechanics

Classes Table:
- Hit die per level
- Proficiencies
- Features at each level
- Subclass available levels
- Spell progression

Subclasses Table:
- Features granted
- Feature descriptions
- Interaction rules

Feats Table:
- Prerequisites
- Ability score changes
- New abilities

Rules Engine:
- Spell-casting rules
- Attack resolution
- Damage calculation
- Condition effects
- Multiclassing
- Feat stacking
```

---

## 2. ROLL20 - VIRTUAL TABLETOP

### What It Does
Browser-based VTT for running TTRPGs online. Includes maps, character sheets, dice rolling, dynamic lighting, real-time collaboration.

### Technology Stack (Post-Jumpgate Rebuild)
- **Frontend**: HTML5/Canvas, WebGL
- **Graphics Engine**: Babylon.js (3D engine used for 2D rendering)
- **Backend**: Node.js, WebSockets
- **Database**: MongoDB or PostgreSQL
- **Real-time Communication**: Socket.io for players and GM
- **File Storage**: S3 for maps and assets

### Core Rendering Engine (Major Innovation)

**Problem**: Original Roll20 was laggy because every object (token, wall, door, effect) needed its own draw call to the GPU.

**Solution**: Use GPU instancing and texture atlasing.

**Texture Atlas Architecture**:
```
Single Large Texture (8192x8192 pixels) containing:
┌─────────────────────────────────────┐
│ Trees        │ Mountains  │ Buildings │
│              │            │           │
│ [Texture 1]  │ [Texture2] │[Texture3] │
├─────────────────────────────────────┤
│ Doors        │ Tokens     │ Effects   │
│              │            │           │
│ [Texture 4]  │ [Texture5] │[Texture6] │
└─────────────────────────────────────┘

Metadata:
[
  { name: "Tree", x: 0, y: 0, width: 256, height: 256 },
  { name: "Mountain", x: 256, y: 0, width: 512, height: 256 },
  ...
]
```

**How It Works**:
1. All tokens use same mesh (rectangle)
2. Send 10,000 instances to GPU with different parameters:
   ```
   Instance 1: position=[100, 200], size=50, uv_rect=[0, 0, 0.1, 0.1]  // Tree
   Instance 2: position=[200, 300], size=50, uv_rect=[0.25, 0, 0.5, 0.25]  // Mountain
   Instance 3: position=[350, 150], size=100, uv_rect=[0.5, 0, 0.8, 0.3]  // Building
   ```
3. **Result**: Single draw call renders all tokens instead of 10,000 calls

**Performance Impact**:
- Before: 10,000 draw calls per frame = lag
- After: 1-10 draw calls per frame = smooth 60 FPS

### Data Structures

**Campaign**:
```json
{
  "campaignId": "campaign_xyz",
  "name": "Curse of Strahd",
  "gameSystem": "dnd5e",
  "dungeonMasterId": "user_dm_1",
  "playerIds": ["user_player_1", "user_player_2"],
  "characterSheets": [...],
  "pages": [
    {
      "pageId": "page_1",
      "name": "Village of Barovia",
      "type": "battle_map",
      "width": 70,
      "height": 70,
      "scale": 5, // feet per square
      "backgroundImageId": "img_barovia",
      "fogOfWar": true,
      "layers": {
        "map": { /* background image */ },
        "objects": { /* tokens, walls, doors */ },
        "lighting": { /* dynamic lighting */ },
        "effects": { /* VFX, spell effects */ }
      }
    }
  ],
  "macros": [
    {
      "name": "Fireball",
      "command": "!roll [Roll20 API script]"
    }
  ],
  "createdAt": "2025-01-01T00:00:00Z"
}
```

**Token (Represents character/creature on map)**:
```json
{
  "tokenId": "token_abc123",
  "pageId": "page_1",
  "name": "Thrash",
  "characterId": "char_thrash",
  "currentX": 350,
  "currentY": 200,
  "width": 50,
  "height": 50,
  "rotation": 0,
  "flipH": false,
  "flipV": false,
  "imageId": "img_token_barbarian",
  "isDefeated": false,
  "aura1Radius": 0,
  "aura2Radius": 0,
  "lightsource": null,
  "emitsLight": false,
  "playerControlled": true,
  "ownerId": "user_player_1",
  "hiddenFromPlayers": false,
  "representedCharacter": "char_thrash",
  "bars": [
    {
      "barNumber": 1,
      "attribute": "hp",
      "value": 45,
      "maxValue": 52,
      "color": "red"
    },
    {
      "barNumber": 2,
      "attribute": "ac",
      "value": 16,
      "color": "blue"
    }
  ]
}
```

### How Roll20 Renders a Map

1. **Server sends map data** to browser:
   - Background image (stored as reference, not in game data)
   - Token positions and properties
   - Walls and lighting geometry
   - Active effects

2. **Browser receives via WebSocket and renders**:
   - Create texture atlas from all token images
   - For each token:
     - Get position, size, image reference
     - Look up texture in atlas
     - Add instance to instancing buffer
   - Send all instances to Babylon.js in one call
   - GPU renders with one or few draw calls

3. **User interacts** (click and drag token):
   - Record mouse movement
   - Calculate new position
   - Send position update to server via Socket.io
   - Server validates (is this player allowed to move this token?)
   - Server broadcasts update to all players
   - All clients update token position and re-render

### Dynamic Lighting

**Problem**: How to calculate what each player can see in real-time?

**Solution**: GPU-based shadow mapping

1. **Define light sources**:
   - Each torch, lantern, or spell effect is a light source
   - Store position, radius, color

2. **Define walls/obstacles**:
   - Line segments that block light

3. **GPU calculation**:
   - For each pixel on screen
   - Calculate if it's within any light source's radius
   - Check if any walls block the light path
   - If lit by light source player controls: render normally
   - If not lit: render as fog of war (dim or black)

4. **Result**: Smooth, real-time dynamic lighting without server-side shadow calculations

### Dice Rolling

**Client-side**:
```javascript
// User clicks "Roll Initiative"
roll = rollFormula("1d20+4")  // 1d20 + 4 modifier
// Returns: [14, 4] = 18 total

// Send to server
socket.emit('roll', {
  rollerId: 'user_player_1',
  rollFormula: '1d20+4',
  result: 18,
  rolls: [14, 4]
})

// Server validates and broadcasts
// All players see: "Thrash rolled 18 for Initiative"
```

**Formula Parser** - must support complex expressions:
- `1d20+5` (single d20, +5 modifier)
- `3d6` (three d6 dice)
- `2d10+1d8+3` (mixed dice with modifier)
- `4d6k3` (roll 4d6, keep highest 3)
- `2d20l1` (roll 2d20, drop lowest 1)

---

## 3. INKARNATE - MAP BUILDER

### What It Does
Browser-based fantasy map creation tool with layers, stamps, brush textures, and interactive features.

### Technology Stack
- **Frontend**: React.js (TypeScript)
- **Backend**: Phoenix/Elixir (server, WebSocket support)
- **Rendering**: Canvas 2D API (not GPU-accelerated like Roll20)
- **Compression**: zlib/pako for storing map data
- **Real-time Sync**: WebSocket for collaboration
- **File Format**: Custom binary format (compressed and optimized)

### Layer System (Unique Architecture)

**Key Insight**: Inkarnate doesn't work like Photoshop.

Traditional Photoshop:
```
[Many layers in a stack]
Layer N
Layer N-1
Layer 3 (user can reorder freely)
Layer 2
Layer 1
```

Inkarnate's Structured System:
```
Brush Layers (textures):
  ├─ Background (bottom)
  ├─ Foreground (middle)
  └─ Top (elevated terrain)

Object Layers (stamps/discrete items):
  ├─ Background Objects
  ├─ Middle Objects
  └─ Foreground Objects

Rendering Order:
1. All brush layers (Background, Foreground, Top)
2. All object layers (Background → Foreground)
```

**Why This Design?**:
- Brush textures blend (water blends with grass)
- Objects stack precisely without ambiguity
- Faster rendering (less complex layer order calculations)
- Intuitive for map creation workflow

### Data Structures

**Map Object**:
```json
{
  "mapId": "map_xyz789",
  "name": "Kingdom of Aethelia",
  "description": "A fantasy kingdom with mountains and forests",
  "mapType": "world", // world, regional, city, dungeon, battle
  "width": 100,
  "height": 100,
  "scale": 1, // pixels per map unit
  "brushLayers": {
    "background": {
      "layerId": "layer_bg",
      "visible": true,
      "opacity": 1.0,
      "pixels": "...compressed_image_data...",
      "mask": "...mask_data..." // shows/hides areas
    },
    "foreground": {
      "layerId": "layer_fg",
      "visible": true,
      "opacity": 1.0,
      "pixels": "...compressed_image_data...",
      "mask": "...mask_data..."
    },
    "top": {
      "layerId": "layer_top",
      "visible": true,
      "opacity": 1.0,
      "pixels": "...compressed_image_data...",
      "mask": "...mask_data..."
    }
  },
  "objectLayers": [
    {
      "layerId": "obj_layer_1",
      "name": "Mountains",
      "zOrder": 1,
      "visible": true,
      "objects": [
        {
          "objectId": "obj_mount_1",
          "stampId": "stamp_mountain_01",
          "x": 50,
          "y": 30,
          "width": 40,
          "height": 35,
          "rotation": 0,
          "flipH": false,
          "flipV": false,
          "opacity": 1.0,
          "tint": "#FFFFFF" // color adjustment
        }
      ]
    },
    {
      "layerId": "obj_layer_2",
      "name": "Cities",
      "zOrder": 2,
      "visible": true,
      "objects": [...]
    }
  ],
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-06-21T14:22:00Z",
  "creatorId": "user_builder_123",
  "isPublic": true
}
```

**Brush Texture**:
- User selects "Grass" brush
- "Paint" across background layer
- System stores: which pixels changed, what texture ID applied
- On render: lookup texture data, draw pixels

**Stamp** (discrete object):
- Tree, mountain, building, icon, text label
- Placed at specific coordinates
- Has width, height, rotation
- Layered in object layers

### Rendering Pipeline

**Draw Operation**:
1. Load map data from database
2. **For each brush layer**:
   - Decompress pixel data
   - Apply mask to show/hide regions
   - Draw to canvas: `ctx.putImageData(...)`
3. **For each object layer** (in z-order):
   - For each object/stamp:
     - Load stamp image
     - Apply transforms (rotation, flip)
     - Draw at x, y coordinates: `ctx.drawImage(...)`
4. **Result**: Fully rendered map on canvas

### Mask System

**Mask** is separate image controlling visibility:
- White pixels = visible
- Black pixels = hidden
- Gray pixels = semi-transparent

**Example**:
- Background layer has island texture everywhere
- Mask drawn as shape of landmass (white) with ocean as black
- Result: Island visible, ocean transparent (reveals background)

### File Format (Compression)

Maps can be large (100x100 pixels × multiple layers).

Inkarnate compresses:
1. Convert brush layer pixels to PNG (highly compressible)
2. Compress with zlib
3. Store object list as JSON (text format is ok for lists)
4. Total: 1-5 MB per map instead of 10+ MB uncompressed

On load:
1. Decompress brush layers
2. Parse object JSON
3. Render to canvas

### Collaboration (Real-time)

**WebSocket Flow**:
1. User A paints grass on background layer
   - Sends: `{ action: "paintBrush", layer: "background", x: 50, y: 30, texture: "grass" }`
2. Server receives, broadcasts to User B
3. User B's client receives update
4. User B's map re-renders with new grass pixels
5. Both users see same map in real-time

---

## 4. WORLD ANVIL - WORLDBUILDING WIKI

### What It Does
Comprehensive worldbuilding platform: wiki-like article system, interconnected maps, timelines, character/location databases, novel-writing tools.

### Technology Stack
- **Frontend**: Vue.js or React, TypeScript
- **Backend**: Node.js/Express or similar REST API
- **Database**: PostgreSQL (relational for structure, articles, links)
- **Search**: Elasticsearch for full-text search across all articles
- **File Storage**: S3 for images
- **Real-time Collaboration**: WebSocket for live co-authoring
- **Export**: PDF generation for finished worlds

### Data Structures

**World/Project**:
```json
{
  "worldId": "world_abc123",
  "name": "The Realm of Aethelia",
  "description": "A fantasy world with elves, dwarves, magic",
  "ownerId": "user_author_456",
  "visibility": "private", // private, shared, public
  "settings": {
    "mapScale": "1 hex = 5 miles",
    "calendarSystem": "custom",
    "magicLevel": "high"
  },
  "articles": [...]  // References to article IDs
}
```

**Article**:
```json
{
  "articleId": "article_xyz789",
  "worldId": "world_abc123",
  "title": "The Kingdom of Westmarch",
  "category": "location", // location, character, organization, item, magic, event, etc
  "content": "...rich HTML content...",
  "metadata": {
    "author": "user_author_456",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2026-06-21T14:22:00Z",
    "views": 245,
    "words": 3500
  },
  "relationships": [
    {
      "type": "capital_city",
      "linkedArticleId": "article_capital_city",
      "bidirectional": true
    },
    {
      "type": "governed_by",
      "linkedArticleId": "article_king_john",
      "bidirectional": false
    }
  ],
  "mapPins": [
    {
      "mapId": "map_world",
      "x": 150,
      "y": 200,
      "label": "Westmarch"
    }
  ],
  "tags": ["kingdom", "human", "western"],
  "visibility": "private",
  "senses": true // can include secret/hidden info
}
```

**Linking System** - the core innovation:

When user types `[[Kingdom of Westmarch]]`:
1. System recognizes double brackets
2. Searches for article with title "Kingdom of Westmarch"
3. Creates bidirectional link: `article_xyz ←→ article_kingdom`
4. On render: link becomes clickable
5. On Kingdom page: shows "related articles" including reference back

**Knowledge Graph**:
```
Character: King John
  ├─ Governs → Kingdom: Westmarch
  ├─ Rules → City: Capital City
  ├─ Married To → Character: Queen Anne
  ├─ Father Of → Character: Prince William
  └─ Enemy Of → Character: Evil Sorcerer

Location: Westmarch
  ├─ Governed By → Character: King John
  ├─ Contains → City: Capital City
  ├─ Borders → Location: Dark Forest
  └─ Capital → City: Capital City
```

This creates explorable knowledge graph.

### Timeline System

**Timeline**:
```json
{
  "timelineId": "timeline_main",
  "worldId": "world_abc123",
  "name": "Main Timeline",
  "type": "linear", // linear, branching, parallel
  "eras": [
    {
      "eraId": "era_ancient",
      "name": "Ancient Age",
      "startYear": -1000,
      "endYear": 0,
      "events": [
        {
          "eventId": "event_founding",
          "title": "Kingdom Founded",
          "year": -500,
          "month": null,
          "day": null,
          "description": "The kingdom was established...",
          "linkedArticles": ["article_kingdom", "article_king_john"]
        }
      ]
    }
  ]
}
```

**Display**: Vertical or horizontal timeline with events connected to specific years/dates.

### Novel Writing Tool

Articles integrate with manuscript:
- Write manuscript chapters
- Reference world articles inline
- Characters, locations auto-highlighted
- Export with world reference sidebar

### Search

**Full-text Elasticsearch Index**:
```
Article: "The Kingdom of Westmarch"
Indexed Fields:
- Title: "kingdom" (high weight)
- Content: "kingdom", "westmarch", "ruled", "capital" (normal weight)
- Category: "location" (searchable filter)
- Tags: "kingdom", "human", "western" (faceted search)

When user searches "kingdom":
→ Elasticsearch returns all articles with "kingdom" in any field
→ Ranked by relevance (title matches score higher)
→ Filtered by category if user selected "Locations"
```

---

## COMPARISON: MAP BUILDERS

| Feature | Inkarnate | Wonderdraft | Campaign Cartographer |
|---------|-----------|-------------|---------------------|
| Tech Stack | React/Phoenix | Desktop (C++?) | Legacy (30 years) |
| Layer System | Structured | Freeform | Limited |
| Rendering | Canvas 2D | GPU (faster) | Old tech |
| Price | $5-25/year subscription | $30 one-time | $50+ one-time |
| Learning Curve | Beginner-friendly | Steeper | Very steep |
| Community | Large, active | Growing | Established |

---

## COMPARISON: WORLD-BUILDING APPS

| Feature | World Anvil | Campfire | LegendKeeper | Kanka |
|---------|------------|----------|--------------|-------|
| Linking System | Yes (robust) | Yes | Yes | Yes |
| Maps | Interactive | Yes | Yes | Yes |
| Real-time Collab | Limited | Yes | Yes | Yes |
| Novel Writing | Yes (integrated) | Yes (primary) | Limited | No |
| Timeline | Yes | Yes | Yes | Yes |
| Price | $5-12/month | Per-module | Free-Premium | Free-Premium |
| Community | 1.5M users | Growing | Smaller | Growing |

---

## KEY TECHNICAL LEARNINGS FOR MY BLOSSOM

### From Everyday Apps:
1. **Sync Architecture**: iCloud's last-write-wins with version tracking
2. **Real-time Updates**: WebSocket push notifications (Google Calendar, Apple)
3. **Database Design**: Distributed databases for scale (iCloud, Google)
4. **Smart Lists**: Evaluated at query time, not stored separately
5. **Integration**: APIs (Google Calendar API, wearable integrations)

### From Entertainment Apps:
1. **Rendering Optimization**: Roll20's texture atlasing + GPU instancing (10x performance)
2. **Layer Systems**: Inkarnate's structured layers vs. free-form (affects UX & performance)
3. **Knowledge Graphs**: World Anvil's linking system creates explorable networks
4. **Microservices Migration**: D&D Beyond's monolith-to-microservices transition (hard but necessary)
5. **Asset Management**: Compression (zlib), texture atlasing, efficient image storage
6. **Real-time Collaboration**: WebSocket architecture for multiple users editing simultaneously

### Technical Debt Patterns:
- **D&D Beyond**: Original "demo" codebase became production system → hard to maintain
- **Roll20**: Monolithic rendering engine → complete Jumpgate rebuild needed
- **Lesson**: Good architecture decisions early save massive refactoring later

### Performance Considerations:
- **GPU Utilization**: Batch rendering (Roll20's approach) vs. Canvas 2D (Inkarnate)
- **Data Compression**: zlib compression critical for large maps/worlds
- **Caching**: Redis for frequently-accessed data (user settings, calendar events)
- **CDN**: Images/assets served from CloudFront or similar

