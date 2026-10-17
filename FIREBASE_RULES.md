# Firebase Realtime Database Rules

## กฎที่ใช้งานอยู่ปัจจุบัน

วางกฎนี้ที่ **Firebase Console → Realtime Database → Rules**:

```json
{
  "rules": {
    "rooms": { ".read": true, ".write": true },
    "presence": { ".read": true, ".write": true },
    "stats": { ".read": true, ".write": true },
    "globalCustomWords": { ".read": true, ".write": true },
    "pairVotes": {
      ".read": true,
      ".write": true,
      "$pair": {
        "voters": {
          "$voter": { ".validate": "newData.hasChildren(['playerId', 'at'])" }
        }
      }
    },
    "learnedPairs": {
      ".read": true,
      ".write": true,
      "$pair": { ".validate": "newData.val() === true" }
    },
    "roomIndex": {
      ".read": true,
      ".write": true,
      "$room": { ".validate": "newData.hasChildren(['id', 'name', 'playerCount', 'status', 'hasPassword'])" }
    }
  }
}
```

(ต้นฉบับอยู่ที่ `firebase.rules.json` — แก้ที่ไฟล์นั้นแล้ว copy มาวางใน Console)

## โครงสร้าง Database

| Path | ใช้ทำอะไร |
|---|---|
| `rooms/` | ข้อมูลห้องเกมทั้งหมด |
| `presence/` | ติดตาม session ที่ online อยู่ (ลบอัตโนมัติเมื่อ disconnect) |
| `stats/totalPlayers` | counter สะสมจำนวนผู้เล่นทั้งหมดตลอดกาล |
| `globalCustomWords/` | คำที่ผู้เล่นเพิ่ม ใช้สุ่มคู่คำในเกมถัดไป |
| `pairVotes/{a\|b}` | โหวต "สองคำนี้ควรเชื่อมกัน" — `voters/{ip_… หรือ p_playerId}` หนึ่งเครือข่ายนับหนึ่งเสียง |
| `learnedPairs/{a\|b}` | คู่ที่โหวตครบ 3 เสียงแล้ว — เชื่อมอัตโนมัติทุกเกม |
| `roomIndex/{roomId}` | สรุปห้องสำหรับ lobby กลาง (ชื่อ, host, จำนวนคน, สถานะ, มีรหัสไหม) — ไม่มีรหัสผ่าน |

## ทำไมไม่ใช้กฎเก่า `rooms/$roomId`

กฎเก่า:
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

ปัญหา: `cleanOldRooms()` ใน `roomService.ts` อ่าน `ref(db, 'rooms')` ทั้งหมด
Firebase อนุญาต read เฉพาะ path ที่มีกฎ — การอ่าน parent node (`rooms`) จะถูก deny เงียบๆ
ทำให้ห้องเก่าไม่ถูกลบและ database บวม

## หมายเหตุด้านความปลอดภัย

แอปนี้ไม่มี authentication จึงเป็น **open read/write** ตามการออกแบบ
ป้องกัน abuse ด้วย Firebase App Check หรือเพิ่ม Auth ได้ในอนาคตหากต้องการ
