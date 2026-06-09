---
description: "วางแผนการ commit โดยดู git status → วิเคราะห์การเปลี่ยนแปลง → จัดกลุ่มไฟล์ตามหัวข้อ → git add และ commit ทีละกลุ่ม"
name: "Git Commit Planner"
argument-hint: "ระบุบริบทเพิ่มเติม (ถ้ามี) เช่น 'เน้น feature X'"
agent: "agent"
tools: [mcp_gitkraken_git_status, mcp_gitkraken_git_log_or_diff, mcp_gitkraken_git_add_or_commit]
---

# วางแผนการ Commit

## ขั้นตอน

### 1. ดูสถานะไฟล์ที่เปลี่ยนแปลง
ใช้ `mcp_gitkraken_git_status` เพื่อดูไฟล์ทั้งหมดที่มีการเปลี่ยนแปลง (modified, untracked, staged)

### 2. วิเคราะห์การเปลี่ยนแปลง
ใช้ `mcp_gitkraken_git_log_or_diff` เพื่อดู diff ของไฟล์ที่เปลี่ยนแปลง และทำความเข้าใจว่าแต่ละไฟล์แก้ไขอะไร

### 3. จัดกลุ่มไฟล์ตามหัวข้อ
วิเคราะห์และจัดกลุ่มไฟล์ที่มีการเปลี่ยนแปลงในหัวข้อ/ฟีเจอร์เดียวกัน เช่น:
- `feat:` — เพิ่มฟีเจอร์ใหม่
- `fix:` — แก้ไขบัก
- `refactor:` — ปรับโครงสร้างโค้ด
- `style:` — แก้ไข CSS/styling
- `chore:` — งาน config, dependencies, build
- `docs:` — แก้ไขเอกสาร
- `test:` — เพิ่ม/แก้ไข tests

### 4. แสดงแผนการ Commit
แสดงรายการ commit ที่วางแผนไว้ก่อน เช่น:

```
Commit 1: feat(game): เพิ่ม X และ Y
  - src/components/GameCanvas.tsx
  - src/hooks/useGameActions.ts

Commit 2: fix(ui): แก้ไข Z
  - src/components/PlayerList.tsx
```

### 5. ดำเนินการ Commit ทีละกลุ่ม
สำหรับแต่ละกลุ่ม:
1. ใช้ `mcp_gitkraken_git_add_or_commit` เพื่อ stage ไฟล์ในกลุ่มนั้น
2. Commit พร้อม message ตาม [Conventional Commits](https://www.conventionalcommits.org/) ในรูปแบบ:
   ```
   <type>(<scope>): <คำอธิบายสั้นๆ เป็นภาษาไทยหรืออังกฤษ>
   ```

## กฎการตั้งชื่อ Commit Message
- ใช้ Conventional Commits format
- scope คือชื่อ module/feature ที่เกี่ยวข้อง (เช่น `game`, `ui`, `auth`, `store`)
- คำอธิบายต้องกระชับและชัดเจน
- ถ้ามีหลายสิ่งที่เปลี่ยนในกลุ่มเดียวกัน ให้ใช้ body อธิบายเพิ่มเติม
