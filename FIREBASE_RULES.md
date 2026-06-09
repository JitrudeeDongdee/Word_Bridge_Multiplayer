# Firebase Realtime Database Rules

## กฎที่ใช้งานอยู่ปัจจุบัน

วางกฎนี้ที่ **Firebase Console → Realtime Database → Rules**:

```json
{
  "rules": {
    "rooms": { ".read": true, ".write": true },
    "presence": { ".read": true, ".write": true },
    "stats": { ".read": true, ".write": true }
  }
}
```

## โครงสร้าง Database

| Path | ใช้ทำอะไร |
|---|---|
| `rooms/` | ข้อมูลห้องเกมทั้งหมด |
| `presence/` | ติดตาม session ที่ online อยู่ (ลบอัตโนมัติเมื่อ disconnect) |
| `stats/totalPlayers` | counter สะสมจำนวนผู้เล่นทั้งหมดตลอดกาล |

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
