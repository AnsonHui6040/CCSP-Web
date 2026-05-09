/**
 * Anson's correct personal schedule for 114-2.
 *
 * All course codes are verified against the 114-2 DB and match exactly
 * by course_name + teacher + time slot + classroom.
 *
 * This seed is deterministic, has no DOM or React dependencies, and is
 * intended only for developer / manual-seed use (not for production).
 *
 * Usage:
 *   import { ANSON_SCHEDULE_SEED } from "@/lib/ansonScheduleSeed";
 *   clearSchedule();
 *   for (const s of ANSON_SCHEDULE_SEED) addSnapshotToSchedule(s);
 */

import type { StoredCourseSnapshot } from "./types";

export const ANSON_SCHEDULE_SEED: StoredCourseSnapshot[] = [
  {
    // 3041 — 人文：人文經典與典範─西方 / 楊得煜 / 星期一 第2,3,4節 C205
    courseCode: "3041",
    year: 114,
    semester: 2,
    courseName: "人文：人文經典與典範─西方",
    courseNameEn: null,
    teachers: [{ name: "楊得煜", slug: "dyyang" }],
    credits: 3,
    timeSlots: [{ weekday: 1, periods: ["2", "3", "4"], classroom: "C205" }],
    rawNote: "共必修1-4",
    tags: [],
    warnings: [],
    rules: [],
    riskLevel: "low",
    deptName: "通識課程:人文領域",
    requiredOrElective: "必修",
  },
  {
    // 1249 — 智慧服務創新實務 / 吳祉芸、周鴻仁 / 星期一 第6,7,8節 M201
    courseCode: "1249",
    year: 114,
    semester: 2,
    courseName: "智慧服務創新實務",
    courseNameEn: null,
    teachers: [
      { name: "吳祉芸", slug: "annacywu" },
      { name: "周鴻仁", slug: "pipechou1111" },
    ],
    credits: 3,
    timeSlots: [{ weekday: 1, periods: ["6", "7", "8"], classroom: "M201" }],
    rawNote: "企管,統計系2-4\n統計系管理群組。管院1167「智慧服務創新實務」 課程併班上課。",
    tags: [],
    warnings: [],
    rules: [],
    riskLevel: "low",
    deptName: "企業管理學系",
    requiredOrElective: "選修",
  },
  {
    // 1241 — 商事法 / 陳柏諭 / 星期二 第3,4節 M108
    courseCode: "1241",
    year: 114,
    semester: 2,
    courseName: "商事法",
    courseNameEn: null,
    teachers: [{ name: "陳柏諭", slug: "poyuchen" }],
    credits: 2,
    timeSlots: [{ weekday: 2, periods: ["3", "4"], classroom: "M108" }],
    rawNote: "企管系3A\n不開放網路選課。",
    tags: ["online_selection_unavailable"],
    warnings: [
      {
        type: "online_selection_unavailable",
        level: "high",
        message: "🔴 不可網選",
      },
    ],
    rules: [],
    riskLevel: "high",
    deptName: "企業管理學系",
    requiredOrElective: "必修",
  },
  {
    // 1237 — 品牌管理 / 謝慧璋 / 星期二 第6,7,8節 M145
    courseCode: "1237",
    year: 114,
    semester: 2,
    courseName: "品牌管理",
    courseNameEn: null,
    teachers: [{ name: "謝慧璋", slug: "hchsieh" }],
    credits: 3,
    timeSlots: [{ weekday: 2, periods: ["6", "7", "8"], classroom: "M145" }],
    rawNote: "企管系3,4\n行銷與數位經營組組必修(6選4)",
    tags: [],
    warnings: [],
    rules: [],
    riskLevel: "low",
    deptName: "企業管理學系",
    requiredOrElective: "必修",
  },
  {
    // 1242 — 企業政策 / 黃延聰 / 星期五 第2,3,4節 M145
    courseCode: "1242",
    year: 114,
    semester: 2,
    courseName: "企業政策",
    courseNameEn: null,
    teachers: [{ name: "黃延聰", slug: "yentsung" }],
    credits: 3,
    timeSlots: [{ weekday: 5, periods: ["2", "3", "4"], classroom: "M145" }],
    rawNote:
      "企管系3A\n先修：企業概論、管理學、行銷管理。不開放網路選課。",
    tags: ["online_selection_unavailable"],
    warnings: [
      {
        type: "online_selection_unavailable",
        level: "high",
        message: "🔴 不可網選",
      },
    ],
    rules: [],
    riskLevel: "high",
    deptName: "企業管理學系",
    requiredOrElective: "必修",
  },
];
